import { type LoaderFunctionArgs, type ActionFunctionArgs, json } from 'react-router';
import { ApiError, resolveToken, unauthorizedResponse, externalFetch, handleApiError } from '~/lib/api/apiUtils';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { withSecurity } from '~/lib/security';

const SUPABASE_TOKEN_KEYS = ['VITE_SUPABASE_ACCESS_TOKEN'];

interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  status: string;
  organization_id: string;
  created_at: string;
}

async function supabaseUserLoader({ request, context }: LoaderFunctionArgs) {
  return handleApiError('SupabaseUser', async () => {
    const token = resolveToken(request, context, ...SUPABASE_TOKEN_KEYS);

    if (!token) {
      const cookieHeader = request.headers.get('Cookie');
      const apiKeys = getApiKeysFromCookie(cookieHeader);
      const envUrl = apiKeys.VITE_SUPABASE_URL || context?.cloudflare?.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const envAnonKey = apiKeys.VITE_SUPABASE_ANON_KEY || context?.cloudflare?.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (envUrl && envAnonKey) {
        return json({
          user: {
            id: 'local',
            name: 'Local Supabase User',
            email: 'local@supabase.local',
          },
          projects: [
            {
              id: 'local-project',
              name: 'Local Supabase Project',
              region: 'local',
              status: 'ACTIVE_HEALTHY',
              organization_id: 'local-org',
              created_at: new Date().toISOString(),
            },
          ],
        });
      }

      return unauthorizedResponse('Supabase');
    }

    const response = await externalFetch({ url: 'https://api.supabase.com/v1/projects', token });

    if (!response.ok) {
      if (response.status === 401) {
        return Response.json({ error: 'Invalid Supabase token' }, { status: 401 });
      }

      throw new ApiError(`Supabase API error: ${response.status}`, response.status);
    }

    const projects = (await response.json()) as SupabaseProject[];

    const user =
      projects.length > 0
        ? {
            id: projects[0].organization_id,
            name: 'Supabase User',
            email: 'user@supabase.co',
          }
        : null;

    return Response.json({
      user,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        region: p.region,
        status: p.status,
        organization_id: p.organization_id,
        created_at: p.created_at,
      })),
    });
  });
}

export const loader = withSecurity(supabaseUserLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});

async function supabaseUserAction({ request, context }: ActionFunctionArgs) {
  return handleApiError('SupabaseUser', async () => {
    const token = resolveToken(request, context, ...SUPABASE_TOKEN_KEYS);
    const formData = await request.formData();
    const action = formData.get('action');

    if (!token) {
      const cookieHeader = request.headers.get('Cookie');
      const apiKeys = getApiKeysFromCookie(cookieHeader);
      const envUrl = apiKeys.VITE_SUPABASE_URL || context?.cloudflare?.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const envAnonKey = apiKeys.VITE_SUPABASE_ANON_KEY || context?.cloudflare?.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (envUrl && envAnonKey) {
        if (action === 'get_projects') {
          return json({
            user: { id: 'local', name: 'Local Supabase User', email: 'local@supabase.local' },
            stats: {
              projects: [
                {
                  id: 'local-project',
                  name: 'Local Supabase Project',
                  region: 'local',
                  status: 'ACTIVE_HEALTHY',
                  organization_id: 'local-org',
                  created_at: new Date().toISOString(),
                },
              ],
              totalProjects: 1,
            },
          });
        }

        if (action === 'get_api_keys') {
          return json({
            apiKeys: [
              { name: 'anon', api_key: envAnonKey },
              { name: 'service_role', api_key: 'local-service-role' },
            ],
          });
        }
      }

      return unauthorizedResponse('Supabase');
    }

    if (action === 'get_projects') {
      const response = await externalFetch({ url: 'https://api.supabase.com/v1/projects', token });

      if (!response.ok) {
        throw new ApiError(`Supabase API error: ${response.status}`, response.status);
      }

      const projects = (await response.json()) as SupabaseProject[];

      const user =
        projects.length > 0
          ? {
              id: projects[0].organization_id,
              name: 'Supabase User',
              email: 'user@supabase.co',
            }
          : null;

      return Response.json({
        user,
        stats: {
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            region: p.region,
            status: p.status,
            organization_id: p.organization_id,
            created_at: p.created_at,
          })),
          totalProjects: projects.length,
        },
      });
    }

    if (action === 'get_api_keys') {
      const projectId = formData.get('projectId');

      if (!projectId) {
        return Response.json({ error: 'Project ID is required' }, { status: 400 });
      }

      const response = await externalFetch({
        url: `https://api.supabase.com/v1/projects/${projectId}/api-keys`,
        token,
      });

      if (!response.ok) {
        throw new ApiError(`Supabase API error: ${response.status}`, response.status);
      }

      const apiKeys = (await response.json()) as Array<{ name: string; api_key: string }>;

      return Response.json({
        apiKeys: apiKeys.map((key) => ({ name: key.name, api_key: key.api_key })),
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  });
}

export const action = withSecurity(supabaseUserAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
