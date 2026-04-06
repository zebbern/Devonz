import type { ActionFunctionArgs } from 'react-router';
import { withSecurity } from '~/lib/security';
import { GitLabApiService } from '~/lib/services/gitlabApiService';
import { createClient } from '@supabase/supabase-js';

async function gitlabDeployHandler({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body: any = await request.json();
    const { repoName, isPrivate, files, userId } = body;

    if (!repoName) {
      return Response.json({ error: 'Repository name is required' }, { status: 400 });
    }

    const token = process.env.GITLAB_ACCESS_TOKEN || process.env.VITE_GITLAB_ACCESS_TOKEN;
    const gitlabUrl = process.env.VITE_GITLAB_URL || 'https://gitlab.com';
    const groupId = process.env.GITLAB_GROUP_ID;

    if (!token) {
      return Response.json(
        { error: 'GitLab is not configured on the server. Missing GITLAB_ACCESS_TOKEN.' },
        { status: 500 },
      );
    }

    if (!groupId) {
      return Response.json(
        { error: 'Server misconfiguration: GITLAB_GROUP_ID is missing. Cannot enforce secure namespace.' },
        { status: 500 },
      );
    }

    const apiService = new GitLabApiService(token, gitlabUrl);

    // Sanitize repository name
    const sanitizedName = repoName
      .replace(/[^a-zA-Z0-9-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    // 1. Try to find if the project already exists within the specific group
    let existingProject = null;

    try {
      // Search for the project specifically within the group to avoid conflicts
      const groupProjectsResponse = await fetch(
        `${gitlabUrl}/api/v4/groups/${groupId}/projects?search=${sanitizedName}`,
        {
          headers: { 'PRIVATE-TOKEN': token },
        },
      );

      if (groupProjectsResponse.ok) {
        const projects = await groupProjectsResponse.json();
        existingProject = projects.find((p: any) => p.path === sanitizedName || p.name === sanitizedName) || null;
      }
    } catch (e) {
      console.warn('Failed to search group projects, continuing with creation attempt', e);
    }

    let project = existingProject;
    const projectExists = !!project;

    // 2. Create the project if it doesn't exist
    if (!projectExists) {
      const response = await fetch(`${gitlabUrl}/api/v4/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': token,
        },
        body: JSON.stringify({
          name: sanitizedName,
          path: sanitizedName,
          namespace_id: parseInt(groupId, 10), // CRITICAL: Enforce group namespace
          visibility: isPrivate ? 'private' : 'public',
          initialize_with_readme: false,
          default_branch: 'main',
          description: `Project created from Devonz App`,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Failed to create project: ${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();

          if (errorData.message?.namespace?.[0]?.includes('is not valid')) {
            errorMessage =
              'Failed to create project: The configured GITLAB_GROUP_ID is either invalid or your GITLAB_ACCESS_TOKEN does not have Developer/Maintainer permissions to create projects in this group.';
          } else {
            errorMessage = `Failed to create project: ${errorData.message ? JSON.stringify(errorData.message) : errorMessage}`;
          }
        } catch {}
        throw new Error(errorMessage);
      }

      project = await response.json();
    } else {
      // If it exists, optionally update visibility
      if (project.visibility !== (isPrivate ? 'private' : 'public')) {
        await apiService.updateProjectVisibility(project.id, isPrivate ? 'private' : 'public');
      }
    }

    if (!project || !project.id) {
      throw new Error('Project creation passed but failed to retrieve project ID.');
    }

    // 3. Upload files to the newly created or existing project
    if (files && Object.keys(files).length > 0) {
      if (!projectExists) {
        // Give new projects a second to initialize
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await apiService.createProjectWithFiles(sanitizedName, isPrivate, files).catch(async () => {
          /*
           * createProjectWithFiles internally calls createProject again if not handled manually.
           * We'll bypass and just use commitFiles directly here.
           */
          const actions = Object.entries(files).map(([filePath, content]) => ({
            action: 'create' as const,
            file_path: filePath,
            content: content as string,
          }));
          await apiService.commitFiles(project.id, {
            branch: 'main',
            commit_message: 'Initial commit from Devonz',
            actions,
          });
        });
      } else {
        await apiService.updateProjectWithFiles(project.id, files);
      }
    }

    if (userId && project?.id) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error: dbError } = await supabase.from('deployments').insert([
          {
            user_id: userId,
            project_name: sanitizedName,
            gitlab_project_id: project.id,
            gitlab_project_url: project.web_url,
          },
        ]);

        if (dbError) {
          console.error('Failed to log deployment to database:', dbError);
        }
      } else {
        console.warn('Supabase credentials missing on server, skipping deployment record insertion.');
      }
    }

    return Response.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        web_url: project.web_url,
        http_url_to_repo: project.http_url_to_repo,
        path_with_namespace: project.path_with_namespace,
      },
      projectExists,
    });
  } catch (error) {
    console.error('Failed to securely deploy to GitLab:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return Response.json({ error: message }, { status: 500 });
  }
}

export const action = withSecurity(gitlabDeployHandler);
