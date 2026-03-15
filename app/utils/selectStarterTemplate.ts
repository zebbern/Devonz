import ignore from 'ignore';
import type { ProviderInfo } from '~/types/model';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from './constants';
import { findBestMatch } from './fuzzy-match';
import { INLINE_TEMPLATES } from './inline-templates';
import { loadShowcaseTemplates } from './showcase-templates';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('StarterTemplate');

/**
 * Known shadcn/ui peer dependencies that MUST be in package.json
 * when using shadcn/ui components. Maps package name to version.
 * These are the Radix UI primitives, icons, and utilities that shadcn/ui imports.
 */
const SHADCN_PEER_DEPS: Record<string, string> = {
  '@radix-ui/react-icons': '^1.3.2',
  '@radix-ui/react-slot': '^1.1.0',
  '@radix-ui/react-label': '^2.1.0',
  '@radix-ui/react-dialog': '^1.1.2',
  '@radix-ui/react-select': '^2.1.2',
  '@radix-ui/react-tabs': '^1.1.1',
  '@radix-ui/react-separator': '^1.1.0',
  '@radix-ui/react-scroll-area': '^1.2.0',
  '@radix-ui/react-avatar': '^1.1.1',
  '@radix-ui/react-checkbox': '^1.1.2',
  '@radix-ui/react-switch': '^1.1.1',
  '@radix-ui/react-toggle': '^1.1.0',
  '@radix-ui/react-toggle-group': '^1.1.0',
  '@radix-ui/react-tooltip': '^1.1.3',
  '@radix-ui/react-popover': '^1.1.2',
  '@radix-ui/react-dropdown-menu': '^2.1.2',
  '@radix-ui/react-context-menu': '^2.2.2',
  '@radix-ui/react-accordion': '^1.2.1',
  '@radix-ui/react-alert-dialog': '^1.1.2',
  '@radix-ui/react-aspect-ratio': '^1.1.0',
  '@radix-ui/react-collapsible': '^1.1.1',
  '@radix-ui/react-hover-card': '^1.1.2',
  '@radix-ui/react-menubar': '^1.1.2',
  '@radix-ui/react-navigation-menu': '^1.2.1',
  '@radix-ui/react-progress': '^1.1.0',
  '@radix-ui/react-radio-group': '^1.2.1',
  '@radix-ui/react-slider': '^1.2.1',
  '@radix-ui/react-toast': '^1.2.2',
  'class-variance-authority': '^0.7.0',
  clsx: '^2.1.1',
  'tailwind-merge': '^2.5.4',
  'lucide-react': '^0.460.0',
  cmdk: '^1.0.0',
  vaul: '^1.1.0',
  sonner: '^1.7.0',
  'input-otp': '^1.4.1',
  'react-day-picker': '^9.4.4',
  'embla-carousel-react': '^8.5.1',
  'react-resizable-panels': '^2.1.7',
  recharts: '^2.15.0',
  'tailwindcss-animate': '^1.0.7',
};

/**
 * Universal packages that LLMs frequently import across any framework.
 * Pre-installed to avoid auto-fix loops caused by missing dependencies.
 */
const UNIVERSAL_EXTRA_PACKAGES: Record<string, string> = {
  'date-fns': '^4.1.0',
  axios: '^1.7.9',
  zod: '^3.24.1',
  nanoid: '^5.1.5',
  clsx: '^2.1.1',
  'tailwind-merge': '^2.5.4',
};

/**
 * React-specific packages that LLMs frequently import in React projects.
 * Only injected into React-family templates (React, Next, Remix, Shadcn).
 */
const REACT_EXTRA_PACKAGES: Record<string, string> = {
  'framer-motion': '^11.15.0',
  'lucide-react': '^0.460.0',
  'react-router-dom': '^7.1.1',
  zustand: '^5.0.3',
  immer: '^10.1.1',
  '@tanstack/react-query': '^5.62.16',
  'react-hook-form': '^7.54.2',
  '@hookform/resolvers': '^3.9.1',
  sonner: '^1.7.0',
  'class-variance-authority': '^0.7.0',
  recharts: '^2.15.0',
};

/**
 * Combined common packages for React-family templates.
 */
const COMMON_EXTRA_PACKAGES: Record<string, string> = {
  ...UNIVERSAL_EXTRA_PACKAGES,
  ...REACT_EXTRA_PACKAGES,
};

/**
 * Vue-specific packages that LLMs frequently import in Vue projects.
 * Only injected into Vue-family templates.
 */
const VUE_EXTRA_PACKAGES: Record<string, string> = {
  pinia: '^3.0.1',
  '@vueuse/core': '^12.5.0',
  'vue-router': '^4.5.0',
  'lucide-vue-next': '^0.460.0',
};

/**
 * Combined packages for Vue-family templates (universal + Vue-specific).
 */
const VUE_COMBINED_PACKAGES: Record<string, string> = {
  ...UNIVERSAL_EXTRA_PACKAGES,
  ...VUE_EXTRA_PACKAGES,
};

/**
 * Svelte-specific packages commonly used by LLMs in SvelteKit projects.
 */
const SVELTE_EXTRA_PACKAGES: Record<string, string> = {
  'svelte-sonner': '^0.3.28',
  'bits-ui': '^1.0.0-next.72',
};

/**
 * Combined packages for Svelte-family templates.
 */
const SVELTE_COMBINED_PACKAGES: Record<string, string> = {
  ...UNIVERSAL_EXTRA_PACKAGES,
  ...SVELTE_EXTRA_PACKAGES,
};

/**
 * SolidJS-specific packages commonly used by LLMs.
 * Only injected into SolidJS templates.
 */
const SOLIDJS_EXTRA_PACKAGES: Record<string, string> = {
  '@solidjs/router': '^0.15.3',
};

/**
 * Combined packages for SolidJS templates.
 */
const SOLIDJS_COMBINED_PACKAGES: Record<string, string> = {
  ...UNIVERSAL_EXTRA_PACKAGES,
  ...SOLIDJS_EXTRA_PACKAGES,
};

/**
 * Angular-specific packages commonly used by LLMs.
 */
const ANGULAR_EXTRA_PACKAGES: Record<string, string> = {
  '@angular/cdk': '^19.0.0',
};

/**
 * Combined packages for Angular templates.
 */
const ANGULAR_COMBINED_PACKAGES: Record<string, string> = {
  ...UNIVERSAL_EXTRA_PACKAGES,
  ...ANGULAR_EXTRA_PACKAGES,
};

/**
 * Maps shadcn/ui component filenames to their primary exports.
 * Used to generate explicit import guidance for the LLM so it
 * imports pre-built components instead of recreating them.
 */
const SHADCN_COMPONENT_EXPORTS: Record<string, string[]> = {
  button: ['Button', 'buttonVariants'],
  card: ['Card', 'CardContent', 'CardDescription', 'CardFooter', 'CardHeader', 'CardTitle'],
  input: ['Input'],
  label: ['Label'],
  badge: ['Badge', 'badgeVariants'],
  separator: ['Separator'],
  textarea: ['Textarea'],
  tabs: ['Tabs', 'TabsContent', 'TabsList', 'TabsTrigger'],
  dialog: [
    'Dialog',
    'DialogContent',
    'DialogDescription',
    'DialogFooter',
    'DialogHeader',
    'DialogTitle',
    'DialogTrigger',
  ],
  select: ['Select', 'SelectContent', 'SelectGroup', 'SelectItem', 'SelectLabel', 'SelectTrigger', 'SelectValue'],

  // Additional components that may be added via GitHub templates
  accordion: ['Accordion', 'AccordionContent', 'AccordionItem', 'AccordionTrigger'],
  checkbox: ['Checkbox'],
  switch: ['Switch'],
  tooltip: ['Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger'],
  popover: ['Popover', 'PopoverContent', 'PopoverTrigger'],
  'dropdown-menu': [
    'DropdownMenu',
    'DropdownMenuContent',
    'DropdownMenuItem',
    'DropdownMenuTrigger',
    'DropdownMenuSeparator',
  ],
  'scroll-area': ['ScrollArea', 'ScrollBar'],
  avatar: ['Avatar', 'AvatarFallback', 'AvatarImage'],
  progress: ['Progress'],
  slider: ['Slider'],
  toggle: ['Toggle'],
  'alert-dialog': [
    'AlertDialog',
    'AlertDialogAction',
    'AlertDialogCancel',
    'AlertDialogContent',
    'AlertDialogDescription',
    'AlertDialogFooter',
    'AlertDialogHeader',
    'AlertDialogTitle',
    'AlertDialogTrigger',
  ],
  chart: ['ChartContainer', 'ChartTooltip', 'ChartTooltipContent', 'ChartLegend', 'ChartLegendContent'],
  toast: ['Toast', 'ToastAction', 'Toaster', 'useToast'],
  sheet: [
    'Sheet',
    'SheetContent',
    'SheetDescription',
    'SheetFooter',
    'SheetHeader',
    'SheetTitle',
    'SheetTrigger',
    'SheetClose',
  ],
  table: ['Table', 'TableBody', 'TableCaption', 'TableCell', 'TableHead', 'TableHeader', 'TableRow', 'TableFooter'],
  form: ['Form', 'FormControl', 'FormDescription', 'FormField', 'FormItem', 'FormLabel', 'FormMessage'],
  command: ['Command', 'CommandDialog', 'CommandEmpty', 'CommandGroup', 'CommandInput', 'CommandItem', 'CommandList'],
  drawer: [
    'Drawer',
    'DrawerContent',
    'DrawerDescription',
    'DrawerFooter',
    'DrawerHeader',
    'DrawerTitle',
    'DrawerTrigger',
    'DrawerClose',
  ],
};

interface PromptTemplate {
  name: string;
  description: string;
  tags?: string[];
}

const starterTemplateSelectionPrompt = (
  starterTemplates: PromptTemplate[],
  showcaseTemplates: PromptTemplate[] = [],
) => `# Role
You are a project initialization assistant. Your sole task is to select the most appropriate starter template based on a user's project description.

# Selection Rules (Strict Priority Order)
1.  **Explicit Framework:** If the user mentions Vue, Svelte, Angular, SolidJS, Qwik, Remix, Astro, or Expo, select that specific template immediately. This overrides all other rules.
2.  **Logic/Scripts:** For trivial tasks (scripts, algorithms, CLI tools, or API-only projects with no UI), select "blank".
3.  **Graphics/High Animation:** For games, canvas, WebGL, 3D (three.js), or animation-heavy projects, select "Vite React".
4.  **Presentations:** For slides or presentations, select "Slidev".
5.  **Mobile:** For iOS, Android, or React Native projects, select "Expo App".
6.  **Content-Focused:** For static sites, blogs, or documentation, select "Basic Astro".
7.  **Vanilla JS:** For projects explicitly requesting no framework, select "Vanilla Vite".
8.  **Logic-Only TS:** For TypeScript projects with no UI framework, select "Vite Typescript".
9.  **Fullstack React:** For projects requiring SSR or API routes, select "NextJS Shadcn".
10. **Site Type:** For specific landing pages, dashboards, SaaS, or e-commerce, use a matching showcase template if available; otherwise, use "Vite Shadcn".
11. **Default:** For any other web project, select "Vite Shadcn".

# Constraints
- Respond ONLY with the XML `<template>` tag.
- No conversational filler, no explanations, and no markdown formatting outside the XML.
- If multiple rules could apply, use the one with the HIGHER priority number (1 is highest).

# Starter Templates
<template><name>blank</name><description>Empty starter for simple scripts</description><tags>basic, script</tags></template>
[Add your other template XML blocks here...]
${starterTemplates.map((t) => `<template><name>${t.name}</name><description>${t.description}</description>${t.tags ? `<tags>${t.tags.join(', ')}</tags>` : ''}</template>`).join('\n')}
${
  showcaseTemplates.length > 0
    ? `
Showcase templates (full pre-built projects):
${showcaseTemplates.map((t) => `<template><name>${t.name}</name><description>${t.description}</description>${t.tags ? `<tags>${t.tags.join(', ')}</tags>` : ''}</template>`).join('\n')}`
    : ''
}

Format:
<selection>
  <templateName>{name}</templateName>
  <title>{short project title}</title>
</selection>
`;

const templates: Template[] = STARTER_TEMPLATES;

const parseSelectedTemplate = (llmOutput: string): { template: string; title: string } | null => {
  try {
    // Extract content between <templateName> tags
    const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/);
    const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/);

    if (!templateNameMatch) {
      return null;
    }

    return { template: templateNameMatch[1].trim(), title: titleMatch?.[1].trim() || 'Untitled Project' };
  } catch (error) {
    logger.error('Error parsing template selection:', error);
    return null;
  }
};

export const selectStarterTemplate = async (options: { message: string; model: string; provider: ProviderInfo }) => {
  const { message, model, provider } = options;

  // Load showcase templates so the LLM can pick a specific pre-built project
  let showcasePromptTemplates: PromptTemplate[] = [];

  try {
    const showcase = await loadShowcaseTemplates();
    showcasePromptTemplates = showcase.map((st) => ({
      name: st.name,
      description: st.description,
      tags: st.tags,
    }));
  } catch {
    logger.warn('Failed to load showcase templates for selection prompt');
  }

  const requestBody = {
    message,
    model,
    provider,
    system: starterTemplateSelectionPrompt(templates, showcasePromptTemplates),
  };

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      logger.warn(`LLM call returned ${response.status}, falling back to blank template`);
      return { template: 'blank', title: '' };
    }

    const respJson = (await response.json()) as { text?: string };
    logger.debug(respJson);

    const text = respJson.text;

    if (!text) {
      logger.warn('LLM response missing text field, falling back to blank template');
      return { template: 'blank', title: '' };
    }

    const selectedTemplate = parseSelectedTemplate(text);

    if (selectedTemplate) {
      return selectedTemplate;
    }

    logger.info('No template selected, using blank template');

    return { template: 'blank', title: '' };
  } catch (error) {
    logger.error('Template selection failed, falling back to blank template:', error);
    return { template: 'blank', title: '' };
  }
};

const getGitHubRepoContent = async (repoName: string): Promise<{ name: string; path: string; content: string }[]> => {
  try {
    // Instead of directly fetching from GitHub, use our own API endpoint as a proxy
    const response = await fetch(`/api/github-template?repo=${encodeURIComponent(repoName)}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Our API will return the files in the format we need
    const files = (await response.json()) as Array<{ name: string; path: string; content: string }>;

    return files;
  } catch (error) {
    logger.error('Error fetching release contents:', error);
    throw error;
  }
};

/**
 * Inject missing shadcn/ui peer dependencies into a template's package.json.
 * Scans component files for @radix-ui imports and ensures those packages
 * are listed in dependencies. This prevents auto-fix loops caused by
 * missing peer deps at runtime.
 */
function injectShadcnPeerDeps(files: Array<{ name: string; path: string; content: string }>): void {
  const pkgJsonFile = files.find((f) => f.path === 'package.json' || f.name === 'package.json');

  if (!pkgJsonFile) {
    return;
  }

  try {
    const pkgJson = JSON.parse(pkgJsonFile.content);
    const deps = pkgJson.dependencies || {};
    const devDeps = pkgJson.devDependencies || {};
    const allExistingDeps = { ...deps, ...devDeps };

    // Collect all @radix-ui and other shadcn imports actually used in component files
    const usedPackages = new Set<string>();

    for (const file of files) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.ts')) {
        continue;
      }

      // Match import/require statements for known peer deps (Radix UI, utilities, and shadcn component deps)
      const peerDepPattern =
        /(?:from\s+|require\s*\(\s*)['"](@radix-ui\/[^'"]+|class-variance-authority|clsx|tailwind-merge|lucide-react|cmdk|vaul|sonner|input-otp|react-day-picker|embla-carousel-react|react-resizable-panels|recharts|tailwindcss-animate)['"]/g;
      const importMatches = file.content.matchAll(peerDepPattern);

      for (const match of importMatches) {
        usedPackages.add(match[1]);
      }
    }

    // Add missing deps that are imported but not in package.json
    let injectedCount = 0;

    for (const pkg of usedPackages) {
      if (!allExistingDeps[pkg] && SHADCN_PEER_DEPS[pkg]) {
        deps[pkg] = SHADCN_PEER_DEPS[pkg];
        injectedCount++;
      }
    }

    /*
     * Always pre-install commonly used packages that LLMs frequently import
     * (e.g. framer-motion, lucide-react) to prevent auto-fix loops
     */
    for (const [pkg, version] of Object.entries(COMMON_EXTRA_PACKAGES)) {
      if (!allExistingDeps[pkg] && !deps[pkg]) {
        deps[pkg] = version;
        injectedCount++;
      }
    }

    if (injectedCount > 0) {
      pkgJson.dependencies = deps;
      pkgJsonFile.content = JSON.stringify(pkgJson, null, 2);
      logger.info(`Injected ${injectedCount} dependencies (peer deps + common packages) into template package.json`);
    }
  } catch (error) {
    logger.error('Failed to inject shadcn peer deps:', error);
  }
}

/**
 * Generic package injector — adds missing packages from a given record
 * into a template's package.json dependencies. Used by all framework-specific
 * injection calls to prevent auto-fix loops caused by missing dependencies.
 */
function injectPackages(
  files: Array<{ name: string; path: string; content: string }>,
  packages: Record<string, string>,
  label: string,
): void {
  const pkgJsonFile = files.find((f) => f.path === 'package.json' || f.name === 'package.json');

  if (!pkgJsonFile) {
    return;
  }

  try {
    const pkgJson = JSON.parse(pkgJsonFile.content);
    const deps = pkgJson.dependencies || {};
    const devDeps = pkgJson.devDependencies || {};
    const allExistingDeps = { ...deps, ...devDeps };
    let injectedCount = 0;

    for (const [pkg, version] of Object.entries(packages)) {
      if (!allExistingDeps[pkg] && !deps[pkg]) {
        deps[pkg] = version;
        injectedCount++;
      }
    }

    if (injectedCount > 0) {
      pkgJson.dependencies = deps;
      pkgJsonFile.content = JSON.stringify(pkgJson, null, 2);
      logger.info(`Injected ${injectedCount} ${label} packages into template package.json`);
    }
  } catch (error) {
    logger.error(`Failed to inject ${label} packages:`, error);
  }
}

/**
 * Detect template architecture from its files.
 * Returns a concise summary for the LLM to understand the project structure.
 */
function detectTemplateArchitecture(files: Array<{ name: string; path: string; content: string }>): string {
  const filePaths = files.map((f) => f.path);
  const parts: string[] = [];

  // Detect entry point
  const entryPoints = [
    'src/App.tsx',
    'src/App.jsx',
    'src/App.vue',
    'src/App.svelte',
    'src/app/page.tsx',
    'src/routes/+page.svelte',
    'src/app/app.component.ts',
    'app/page.tsx',
    'app/root.tsx',
    'app/routes/_index.tsx',
    'pages/index.tsx',
    'src/main.tsx',
    'src/main.ts',
  ];
  const foundEntry = entryPoints.find((ep) => filePaths.includes(ep));

  if (foundEntry) {
    parts.push(`Entry: ${foundEntry}`);
  }

  // Detect component directory
  const componentDirs = ['src/components/', 'components/', 'src/components/ui/', 'app/components/'];
  const foundCompDir = componentDirs.find((d) => filePaths.some((fp) => fp.startsWith(d)));

  if (foundCompDir) {
    parts.push(`Components: ${foundCompDir}`);
  }

  // Detect routing
  const pkgFile = files.find((f) => f.path === 'package.json');

  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps['react-router-dom']) {
        parts.push('Routing: react-router-dom');
      } else if (allDeps['vue-router']) {
        parts.push('Routing: vue-router');
      } else if (allDeps['@sveltejs/kit']) {
        parts.push('Routing: SvelteKit file-based');
      } else if (allDeps.next) {
        parts.push('Routing: Next.js App Router');
      } else if (allDeps['@angular/router']) {
        parts.push('Routing: Angular Router');
      }

      // Detect CSS framework
      if (allDeps.tailwindcss) {
        const hasTwConfig = filePaths.some((fp) => fp.includes('tailwind.config'));
        parts.push(hasTwConfig ? 'CSS: Tailwind v3' : 'CSS: Tailwind v4');
      }
    } catch {
      // skip
    }
  }

  return parts.length > 0 ? parts.join(' | ') : '';
}

/**
 * Build a compact directory listing from template file paths.
 * Shows directories the LLM should use for new files.
 */
function buildDirectoryHint(files: Array<{ path: string }>): string {
  const dirs = new Set<string>();

  for (const f of files) {
    const parts = f.path.split('/');

    // Collect up to 2 levels deep (e.g., "src/components/")
    if (parts.length >= 2) {
      dirs.add(`${parts[0]}/`);

      if (parts.length >= 3) {
        dirs.add(`${parts[0]}/${parts[1]}/`);
      }
    }
  }

  // Filter out noise directories
  const ignore = new Set(['.git/', '.github/', '.devonz/', 'node_modules/', '.vscode/']);
  const sorted = [...dirs].filter((d) => !ignore.has(d)).sort();

  return sorted.length > 0 ? sorted.join(', ') : '';
}

/**
 * Build explicit import examples for pre-built shadcn/ui components.
 * Generates actual import statements the LLM can copy, e.g.:
 *   import { Button } from "@/components/ui/button"
 *   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
 *
 * This dramatically improves LLM compliance — showing exact syntax
 * is far more effective than listing filenames.
 */
function buildShadcnImportGuide(componentNames: string[], shadcnDir: string, usesAtAlias: boolean): string {
  if (componentNames.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const name of componentNames) {
    const exports = SHADCN_COMPONENT_EXPORTS[name];

    if (!exports) {
      // Unknown component — still list it with PascalCase name
      const pascalName = name.charAt(0).toUpperCase() + name.slice(1);
      const importPath = usesAtAlias ? `@/${shadcnDir}${name}` : `./${shadcnDir}${name}`;
      lines.push(`import { ${pascalName} } from "${importPath}"`);
      continue;
    }

    const importPath = usesAtAlias ? `@/${shadcnDir}${name}` : `./${shadcnDir}${name}`;

    // Show ALL exports so the LLM knows every available sub-component
    lines.push(`import { ${exports.join(', ')} } from "${importPath}"`);
  }

  return lines.join('\n');
}

/**
 * Frameworks whose templates should get full COMMON_EXTRA_PACKAGES
 * (React-specific + universal) injected into package.json.
 */
const REACT_TEMPLATE_KEYWORDS = ['react', 'next', 'remix', 'shadcn'];

/**
 * Returns true when `templateName` is a React-family framework.
 */
function isReactFamily(templateName: string): boolean {
  const lower = templateName.toLowerCase();
  return REACT_TEMPLATE_KEYWORDS.some((kw) => lower.includes(kw));
}

const VUE_TEMPLATE_KEYWORDS = ['vue'];

/**
 * Returns true when `templateName` is a Vue-family framework.
 * Excludes Slidev (presentation framework) which is Vue-based but not a general Vue app.
 */
function isVueFamily(templateName: string): boolean {
  const lower = templateName.toLowerCase();
  return VUE_TEMPLATE_KEYWORDS.some((kw) => lower.includes(kw)) && !lower.includes('slidev');
}

const SVELTE_TEMPLATE_KEYWORDS = ['svelte', 'sveltekit'];

/**
 * Returns true when `templateName` is a Svelte-family framework.
 */
function isSvelteFamily(templateName: string): boolean {
  const lower = templateName.toLowerCase();
  return SVELTE_TEMPLATE_KEYWORDS.some((kw) => lower.includes(kw));
}

const ANGULAR_TEMPLATE_KEYWORDS = ['angular'];

/**
 * Returns true when `templateName` is an Angular framework.
 */
function isAngularFamily(templateName: string): boolean {
  const lower = templateName.toLowerCase();
  return ANGULAR_TEMPLATE_KEYWORDS.some((kw) => lower.includes(kw));
}

const SOLIDJS_TEMPLATE_KEYWORDS = ['solid', 'solidjs'];

/**
 * Returns true when `templateName` is a SolidJS framework.
 */
function isSolidFamily(templateName: string): boolean {
  const lower = templateName.toLowerCase();
  return SOLIDJS_TEMPLATE_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function getTemplates(templateName: string, title?: string) {
  /*
   * ——— Step 1: Resolve template by name (exact → fuzzy → showcase) ———
   */
  let template: Template | undefined = STARTER_TEMPLATES.find((t) => t.name === templateName);
  let showcaseRepo: string | undefined;
  let resolvedName = templateName;

  // If no exact starter match, try fuzzy matching against starter names
  if (!template) {
    const starterNames = STARTER_TEMPLATES.map((t) => t.name);
    const fuzzyStarterMatch = findBestMatch(templateName, starterNames);

    if (fuzzyStarterMatch) {
      template = STARTER_TEMPLATES.find((t) => t.name === fuzzyStarterMatch);
      logger.info(`Fuzzy matched "${templateName}" → starter "${fuzzyStarterMatch}"`);
      resolvedName = fuzzyStarterMatch;
    }
  }

  // If still no starter match, check showcase templates (exact then fuzzy)
  if (!template) {
    try {
      const showcaseTemplates = await loadShowcaseTemplates();
      const showcaseMatch = showcaseTemplates.find((st) => st.name === templateName);

      if (showcaseMatch) {
        showcaseRepo = showcaseMatch.githubRepo;
        resolvedName = showcaseMatch.name;
      } else {
        const showcaseNames = showcaseTemplates.map((st) => st.name);
        const fuzzyShowcaseMatch = findBestMatch(templateName, showcaseNames);

        if (fuzzyShowcaseMatch) {
          const matched = showcaseTemplates.find((st) => st.name === fuzzyShowcaseMatch);

          if (matched) {
            showcaseRepo = matched.githubRepo;
            resolvedName = matched.name;
            logger.info(`Fuzzy matched "${templateName}" → showcase "${fuzzyShowcaseMatch}"`);
          }
        }
      }
    } catch {
      logger.warn('Failed to load showcase templates');
    }
  }

  if (!template && !showcaseRepo) {
    logger.warn(`No template match found for "${templateName}"`);
    return null;
  }

  /*
   * ——— Step 2: Fetch template files (inline → GitHub → fallback) ———
   */
  let files: Array<{ name: string; path: string; content: string }>;

  if (template) {
    const inlineFiles = INLINE_TEMPLATES[template.name];

    if (inlineFiles) {
      files = inlineFiles.map((f) => ({ ...f }));
      logger.info(`Using inline template for "${template.name}" (${files.length} files)`);
    } else {
      logger.info(`No inline content for "${template.name}", fetching from GitHub`);
      files = await getGitHubRepoContent(template.githubRepo);
    }
  } else {
    // Showcase template — try GitHub; on failure, fall back to closest starter
    logger.info(`Fetching showcase template from GitHub: ${showcaseRepo}`);

    try {
      files = await getGitHubRepoContent(showcaseRepo!);
    } catch (error) {
      logger.warn(`Showcase fetch failed for "${resolvedName}", falling back to closest starter`, error);

      // Find the best starter template as fallback
      const starterNames = STARTER_TEMPLATES.map((t) => t.name);
      const fallbackName = findBestMatch(resolvedName, starterNames) ?? 'Vite Shadcn';
      const fallback = STARTER_TEMPLATES.find((t) => t.name === fallbackName)!;
      const fallbackInline = INLINE_TEMPLATES[fallback.name];

      if (fallbackInline) {
        files = fallbackInline.map((f) => ({ ...f }));
        logger.info(`Falling back to inline starter "${fallback.name}" (${files.length} files)`);
      } else {
        files = await getGitHubRepoContent(fallback.githubRepo);
      }

      // Update resolved name so downstream messages reference the actual template used
      resolvedName = fallback.name;
      template = fallback;
    }
  }

  /*
   * ——— Step 3: Inject dependencies ———
   * - Shadcn templates: inject peer deps + React common + universal packages
   * - Other React-family templates: inject React common + universal packages
   * - Vue-family templates: inject Vue-specific + universal packages
   * - Svelte-family templates: inject Svelte-specific + universal packages
   * - Angular templates: inject Angular-specific + universal packages
   * - All other frameworks (Astro, Solid, Qwik, etc.): inject universal packages only
   */
  if (resolvedName.toLowerCase().includes('shadcn')) {
    injectShadcnPeerDeps(files);
  } else if (isReactFamily(resolvedName)) {
    injectPackages(files, COMMON_EXTRA_PACKAGES, 'common');
  } else if (isVueFamily(resolvedName)) {
    injectPackages(files, VUE_COMBINED_PACKAGES, 'Vue + universal');
  } else if (isSvelteFamily(resolvedName)) {
    injectPackages(files, SVELTE_COMBINED_PACKAGES, 'Svelte + universal');
  } else if (isAngularFamily(resolvedName)) {
    injectPackages(files, ANGULAR_COMBINED_PACKAGES, 'Angular + universal');
  } else if (isSolidFamily(resolvedName)) {
    injectPackages(files, SOLIDJS_COMBINED_PACKAGES, 'SolidJS + universal');
  } else {
    /*
     * All other templates (Astro, Qwik, Slidev, etc.)
     * get framework-agnostic universal packages (date-fns, axios, zod)
     */
    injectPackages(files, UNIVERSAL_EXTRA_PACKAGES, 'universal');
  }

  let filteredFiles = files;

  /*
   * ignoring common unwanted files
   * exclude    .git
   */
  filteredFiles = filteredFiles.filter((x) => !x.path.startsWith('.git'));

  /*
   * Lock files are included for faster npm install times.
   * Previously excluded, now kept intentionally.
   */

  // exclude    .devonz
  filteredFiles = filteredFiles.filter((x) => !x.path.startsWith('.devonz'));

  // check for ignore file in .devonz folder
  const templateIgnoreFile = files.find((x) => x.path.startsWith('.devonz') && x.name === 'ignore');

  const filesToImport = {
    files: filteredFiles,
    ignoreFile: [] as typeof filteredFiles,
  };

  if (templateIgnoreFile) {
    // redacting files specified in ignore file
    const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
    const ig = ignore().add(ignorepatterns);

    // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
    const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

    filesToImport.files = filteredFiles;
    filesToImport.ignoreFile = ignoredFiles;
  }

  const displayName = template?.name || resolvedName;

  const assistantMessage = `
Devonz is initializing your project with the required files using the ${displayName} template.
<devonzArtifact id="imported-files" title="${title || 'Create initial files'}" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<devonzAction type="file" filePath="${file.path}">
${file.content}
</devonzAction>`,
  )
  .join('\n')}
<devonzAction type="shell">npm install --legacy-peer-deps</devonzAction>
<devonzAction type="start">npm run dev</devonzAction>
</devonzArtifact>
`;
  let userMessage = ``;
  const templatePromptFile = files.filter((x) => x.path.startsWith('.devonz')).find((x) => x.name === 'prompt');

  if (templatePromptFile) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

---
`;
  }

  if (filesToImport.ignoreFile.length > 0) {
    userMessage =
      userMessage +
      `
READ-ONLY FILES — do NOT modify, delete, rename, or recreate these:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}
You may import/read/reference them. If changes are needed, create new files instead.
`;
  }

  /*
   * Dependency preservation instructions — apply to ALL templates.
   * Prevents the LLM from rewriting package.json and dropping critical deps.
   */
  const pkgFile = files.find((f) => f.path === 'package.json' || f.name === 'package.json');

  if (pkgFile) {
    try {
      const pkgJson = JSON.parse(pkgFile.content);
      const depCount = Object.keys(pkgJson.dependencies || {}).length;

      // Detect Tailwind CSS version from devDependencies
      const tailwindVersion = pkgJson.devDependencies?.tailwindcss || '';
      const isTailwindV3 =
        tailwindVersion.startsWith('^3') || tailwindVersion.startsWith('~3') || tailwindVersion.startsWith('3');

      // Detect React version to prevent API mismatch
      const reactVersion = pkgJson.dependencies?.react || '';
      const isReact18 =
        reactVersion.startsWith('^18') || reactVersion.startsWith('~18') || reactVersion.startsWith('18');
      const isReact19 =
        reactVersion.startsWith('^19') || reactVersion.startsWith('~19') || reactVersion.startsWith('19');

      userMessage += `
⚠️ DEPENDENCY RULES:
- ${depCount} pre-configured dependencies exist. NEVER rewrite package.json from scratch.
- Only ADD new dependencies — keep ALL existing ones.
- If you import a new npm package in code, add it to package.json dependencies FIRST.
${resolvedName.toLowerCase().includes('shadcn') ? `- Shadcn/ui template: All Radix UI peer deps are pre-installed. Do NOT re-add them to package.json.\n` : ''}${isTailwindV3 ? `- Tailwind CSS v3 syntax: \`@tailwind base; @tailwind components; @tailwind utilities;\` — NOT \`@import "tailwindcss";\`.\n` : ''}${isReact18 ? `- React 18 project: Use forwardRef, manual useMemo/useCallback. Do NOT use React 19 APIs (useActionState, use(), ref-as-prop).\n` : ''}${isReact19 ? `- React 19 project: Use ref as prop (no forwardRef), useActionState, use() hook. React Compiler handles memoization.\n` : ''}`;
    } catch {
      // Failed to parse package.json, skip dep preservation instructions
    }
  }

  // Build a concise hint of pre-installed packages so the LLM uses them
  let availablePackageHint: string;

  if (resolvedName.toLowerCase().includes('shadcn')) {
    availablePackageHint = `shadcn/ui peer deps, ${Object.keys(COMMON_EXTRA_PACKAGES).join(', ')}`;
  } else if (isReactFamily(resolvedName)) {
    availablePackageHint = Object.keys(COMMON_EXTRA_PACKAGES).join(', ');
  } else if (isVueFamily(resolvedName)) {
    availablePackageHint = Object.keys(VUE_COMBINED_PACKAGES).join(', ');
  } else if (isSvelteFamily(resolvedName)) {
    availablePackageHint = Object.keys(SVELTE_COMBINED_PACKAGES).join(', ');
  } else if (isAngularFamily(resolvedName)) {
    availablePackageHint = Object.keys(ANGULAR_COMBINED_PACKAGES).join(', ');
  } else if (isSolidFamily(resolvedName)) {
    availablePackageHint = Object.keys(SOLIDJS_COMBINED_PACKAGES).join(', ');
  } else {
    availablePackageHint = Object.keys(UNIVERSAL_EXTRA_PACKAGES).join(', ');
  }

  // Detect template architecture for LLM context
  const archSummary = detectTemplateArchitecture(filteredFiles);
  const dirHint = buildDirectoryHint(filteredFiles);

  // Detect the main entry point file the LLM should start modifying
  const entryPointPriority = [
    'src/App.tsx',
    'src/App.jsx',
    'src/App.vue',
    'src/App.svelte',
    'src/routes/+page.svelte',
    'app/page.tsx',
    'app/root.tsx',
    'app/routes/_index.tsx',
    'pages/index.tsx',
    'src/app/app.component.ts',
    'src/main.tsx',
    'src/main.ts',
  ];
  const filePaths = filteredFiles.map((f) => f.path);
  const mainEntryFile = entryPointPriority.find((ep) => filePaths.includes(ep));

  // Detect cn() utility location so the LLM uses it instead of creating its own
  const cnUtilityPaths = ['src/lib/utils.ts', 'lib/utils.ts', 'src/utils.ts', 'utils/cn.ts'];
  const cnUtilityFile = cnUtilityPaths.find((p) => filePaths.includes(p));

  /*
   * Determine if the template uses @/ import alias
   * Check tsconfig.json content for path aliases, fall back to config file detection
   */
  const tsconfigFile = filteredFiles.find(
    (f) => f.path === 'tsconfig.json' || f.name === 'tsconfig.json' || f.path === 'tsconfig.app.json',
  );
  const hasPathAliasInTsconfig = tsconfigFile?.content?.includes('"@/') || tsconfigFile?.content?.includes("'@/");
  const usesAtAlias =
    hasPathAliasInTsconfig ||
    filePaths.some((fp) => fp.includes('vite.config')) ||
    filePaths.some((fp) => fp.includes('next.config'));

  // Detect pre-built shadcn/ui components so the LLM uses them instead of recreating
  const shadcnComponentDirs = ['src/components/ui/', 'components/ui/'];
  const shadcnDir = shadcnComponentDirs.find((d) => filePaths.some((fp) => fp.startsWith(d)));
  const shadcnComponents = shadcnDir
    ? filePaths
        .filter((fp) => fp.startsWith(shadcnDir) && fp.endsWith('.tsx'))
        .map((fp) => fp.slice(shadcnDir.length, -4))
    : [];

  // Build explicit import guide for shadcn components
  const shadcnImportGuide =
    shadcnComponents.length > 0 ? buildShadcnImportGuide(shadcnComponents, shadcnDir!, usesAtAlias) : '';

  userMessage += `
Template "${displayName}" imported and running. All files are already created and installed — DO NOT recreate them.
${archSummary ? `Architecture: ${archSummary}\n` : ''}${dirHint ? `Directories: ${dirHint}\n` : ''}Available packages (already in package.json — import ONLY the ones your code actually uses): ${availablePackageHint}.
IMPORT DISCIPLINE: Do NOT import packages just because they're available. A todo app does NOT need framer-motion, recharts, or @tanstack/react-query. Only import what you directly use in your code.
${mainEntryFile ? `Primary file to modify: ${mainEntryFile}\n` : ''}${cnUtilityFile ? `Class utility: import { cn } from '${cnUtilityFile.startsWith('src/') ? `@/${cnUtilityFile.slice(4, -3)}` : `./${cnUtilityFile.slice(0, -3)}`}' — use cn() for conditional class merging.\n` : ''}${
    shadcnImportGuide
      ? `PRE-BUILT COMPONENTS — use these imports directly, do NOT recreate these files:
${shadcnImportGuide}
`
      : ''
  }`;

  /*
   * Add framework-specific coding hints for non-React frameworks
   * (The system prompt is heavily React-focused, so these prevent the LLM from generating React patterns)
   */
  if (isVueFamily(resolvedName)) {
    userMessage += `
FRAMEWORK: Vue 3 — Use Composition API (<script setup>), reactive()/ref(), computed(), Pinia for state, vue-router for routing. Do NOT use React patterns.
`;
  } else if (isSvelteFamily(resolvedName)) {
    userMessage += `
FRAMEWORK: SvelteKit — Use .svelte files with <script>, reactive $: statements, Svelte stores for state, file-based routing (+page.svelte, +layout.svelte). Do NOT use React patterns.
`;
  } else if (isAngularFamily(resolvedName)) {
    userMessage += `
FRAMEWORK: Angular — Use @Component decorators, Angular templates, services with @Injectable, Angular Router, RxJS Observables. Do NOT use React patterns.
`;
  } else if (isSolidFamily(resolvedName)) {
    userMessage += `
FRAMEWORK: SolidJS — Use createSignal(), createEffect(), createMemo(), JSX (looks like React but different reactivity). Use @solidjs/router for routing. Do NOT use React hooks (useState, useEffect).
`;
  }

  userMessage += `
RULES:
1. MODIFY existing files — do NOT recreate config files (vite.config, tsconfig, tailwind.config, package.json).
2. Follow existing directory structure. New components go in the components directory.
3. PREFER pre-installed packages over alternatives — but only import the ones your feature actually needs.
4. Keep the template's styling approach. Build a COMPLETE working app — no placeholders or stubs.
5. Only run npm install when adding NEW packages not already installed.
6. If the app needs sample data, create a src/data/seed.ts file with a getInitialData() function — do NOT scatter hardcoded arrays across components.
7. App.tsx MUST render the user's requested feature — NEVER leave the template default content.
8. If using react-router-dom: wrap the entire app in <BrowserRouter> inside App.tsx, define ALL <Route> elements matching every nav link. Every route MUST render a real page component.
9. If using sonner for toasts: add <Toaster /> in App.tsx (import from 'sonner'). Call toast() from event handlers.
10. When modifying the CSS entry file (index.css or globals.css), ALWAYS preserve the Tailwind directives at the top (@import "tailwindcss" for v4, or @tailwind base/components/utilities for v3) and existing @layer base definitions for CSS variables. Add your styles BELOW the existing content.
11. MINIMAL IMPORTS: Only add import statements for packages you directly call/use in that file. Every import MUST have a corresponding usage. Never import a package "for later" or "just in case".
12. CLEAN FILE STRUCTURE: Create the minimum number of files needed. A simple app needs 3-5 files, not 15. Start lean — users can always ask for more features.

Implement the user's request below by modifying existing files and adding new ones as needed.
`;

  return {
    assistantMessage,
    userMessage,
  };
}
