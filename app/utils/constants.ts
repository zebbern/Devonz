import { LLMManager } from '~/lib/modules/llm/manager';
import type { Template } from '~/types/template';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'alinma_coder_file_modifications';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const PROVIDER_REGEX = /\[Provider: (.*?)\]\n\n/;
export const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
export const PROMPT_COOKIE_KEY = 'cachedPrompt';
export const TOOL_EXECUTION_APPROVAL = {
  APPROVE: 'Yes, approved.',
  REJECT: 'No, rejected.',
} as const;
export const TOOL_NO_EXECUTE_FUNCTION = 'Error: No execute function found on tool';
export const TOOL_EXECUTION_DENIED = 'Error: User denied access to tool execution';
export const TOOL_EXECUTION_ERROR = 'Error: An error occured while calling tool';

const llmManager = LLMManager.getInstance(import.meta.env);

export const PROVIDER_LIST = llmManager.getAllProviders();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();

export const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {};
PROVIDER_LIST.forEach((provider) => {
  providerBaseUrlEnvKeys[provider.name] = {
    baseUrlKey: provider.config.baseUrlKey,
    apiTokenKey: provider.config.apiTokenKey,
  };
});

// starter Templates

export const STARTER_TEMPLATES: Template[] = [
  {
    name: 'Expo App',
    label: 'Expo App',
    description: 'Expo starter template for building cross-platform mobile apps',
    githubRepo: 'xKevIsDev/devonz-expo-template',
    tags: ['mobile', 'expo', 'mobile-app', 'android', 'iphone'],
    icon: 'i-devonz:expo',
  },
  {
    name: 'Basic Astro',
    label: 'Astro Basic',
    description: 'Lightweight Astro starter template for building fast static websites',
    githubRepo: 'xKevIsDev/devonz-astro-basic-template',
    tags: ['astro', 'blog', 'performance', 'static', 'docs', 'documentation', 'landing-page', 'content'],
    icon: 'i-devonz:astro',
  },
  {
    name: 'NextJS Shadcn',
    label: 'Next.js with shadcn/ui',
    description: 'Next.js starter fullstack template with SSR, API routes, and shadcn/ui components',
    githubRepo: 'xKevIsDev/devonz-nextjs-shadcn-template',
    tags: ['nextjs', 'react', 'typescript', 'shadcn', 'tailwind', 'fullstack', 'ssr', 'api-routes'],
    icon: 'i-devonz:nextjs',
  },
  {
    name: 'Vite Shadcn',
    label: 'Vite with shadcn/ui',
    description: 'Vite starter template with shadcn/ui components — the default for most web projects',
    githubRepo: 'xKevIsDev/vite-shadcn',
    tags: [
      'vite',
      'react',
      'typescript',
      'shadcn',
      'tailwind',
      'spa',
      'dashboard',
      'saas',
      'admin',
      'crud',
      'form',
      'ui',
    ],
    icon: 'i-devonz:shadcn',
  },
  {
    name: 'Qwik Typescript',
    label: 'Qwik TypeScript',
    description: 'Qwik framework starter with TypeScript for building resumable applications',
    githubRepo: 'xKevIsDev/devonz-qwik-ts-template',
    tags: ['qwik', 'typescript', 'performance', 'resumable'],
    icon: 'i-devonz:qwik',
  },
  {
    name: 'Remix Typescript',
    label: 'Remix TypeScript',
    description: 'Remix framework starter with TypeScript for full-stack web applications',
    githubRepo: 'xKevIsDev/devonz-remix-ts-template',
    tags: ['remix', 'typescript', 'fullstack', 'react'],
    icon: 'i-devonz:remix',
  },
  {
    name: 'Slidev',
    label: 'Slidev Presentation',
    description: 'Slidev starter template for creating presentations, slide decks, and pitch decks using Markdown',
    githubRepo: 'xKevIsDev/devonz-slidev-template',
    tags: [
      'slidev',
      'presentation',
      'markdown',
      'slides',
      'slide',
      'deck',
      'pitch',
      'sales',
      'keynote',
      'slideshow',
      'talk',
    ],
    icon: 'i-devonz:slidev',
  },
  {
    name: 'Sveltekit',
    label: 'SvelteKit',
    description: 'SvelteKit starter template for building fast, efficient web applications',
    githubRepo: 'devonz-sveltekit-template',
    tags: ['svelte', 'sveltekit', 'typescript'],
    icon: 'i-devonz:svelte',
  },
  {
    name: 'Vanilla Vite',
    label: 'Vanilla + Vite',
    description: 'Minimal Vite starter template for vanilla JavaScript projects',
    githubRepo: 'xKevIsDev/vanilla-vite-template',
    tags: ['vite', 'vanilla-js', 'minimal', 'javascript', 'simple', 'plain'],
    icon: 'i-devonz:vite',
  },
  {
    name: 'Vite React',
    label: 'React + Vite + Tailwind',
    description: 'React starter template powered by Vite with Tailwind CSS v4 for fast development',
    githubRepo: 'xKevIsDev/devonz-vite-react-ts-template',
    tags: ['react', 'vite', 'tailwind', 'frontend', 'website', 'app', 'game', 'canvas', 'animation'],
    icon: 'i-devonz:react',
  },
  {
    name: 'Vite Typescript',
    label: 'Vite + TypeScript',
    description: 'Vite starter template with TypeScript configuration for type-safe development',
    githubRepo: 'xKevIsDev/devonz-vite-ts-template',
    tags: ['vite', 'typescript', 'minimal'],
    icon: 'i-devonz:typescript',
  },
  {
    name: 'Vue',
    label: 'Vue.js',
    description: 'Vue.js starter template with modern tooling and best practices',
    githubRepo: 'xKevIsDev/devonz-vue-template',
    tags: ['vue', 'typescript', 'frontend'],
    icon: 'i-devonz:vue',
  },
  {
    name: 'Angular',
    label: 'Angular Starter',
    description: 'A modern Angular starter template with TypeScript support and best practices configuration',
    githubRepo: 'xKevIsDev/devonz-angular-template',
    tags: ['angular', 'typescript', 'frontend', 'spa'],
    icon: 'i-devonz:angular',
  },
  {
    name: 'SolidJS',
    label: 'SolidJS Tailwind',
    description: 'Lightweight SolidJS starter template for building fast static websites',
    githubRepo: 'xKevIsDev/solidjs-ts-tw',
    tags: ['solidjs', 'solid', 'reactive', 'tailwind', 'typescript'],
    icon: 'i-devonz:solidjs',
  },
];
