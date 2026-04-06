import { reactRouter } from '@react-router/dev/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import UnoCSS from 'unocss/vite';
import type { PluginOption } from 'vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig((config) => {
  return {
    server: {
      fs: {
        /*
         * Allow serving files when ?url= query param is used. Vite reserves ?url for
         * its module system, which conflicts with our template import ?url=https://... pattern.
         */
        strict: false,
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      target: 'esnext',
      sourcemap: true,
      rollupOptions: {
        // Externalize undici and util/types for client builds - these are server-only modules
        external: ['undici', 'util/types', 'node:util/types'],
      },
    },
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'react-router',
        '@nanostores/react',
      ],
      alias: {
        // Provide empty shim for util/types in client builds
        'util/types': 'rollup-plugin-node-polyfills/polyfills/empty',
        'node:util/types': 'rollup-plugin-node-polyfills/polyfills/empty',

      },
    },
    ssr: {
      // Use native Node.js modules for SSR - don't polyfill these
      noExternal: [],
      external: [
        'stream',
        'node:stream',
        'util',
        'util/types',
        'node:util',
        'node:util/types',
        'buffer',
        'node:buffer',
        '@sentry/node',
        'isbot',
        'react-dom/server',
        'path',
        'node:path',
        'react-window',
      ],
    },
    plugins: [
      {
        name: 'buffer-polyfill',
        transform(code: string, id: string) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }

          return null;
        },
      },
      reactRouter(),
      UnoCSS(),
      tsconfigPaths(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      process.env.ANALYZE
        ? visualizer({
            filename: 'stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
          })
        : false,
      config.mode === 'production' &&
        process.env.SENTRY_AUTH_TOKEN &&
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            filesToDeleteAfterUpload: ['./build/**/*.map'],
          },
          telemetry: false,
        }),
    ].filter(Boolean) as PluginOption[],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OPENAI_LIKE_API_MODELS',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
      'SENTRY_DSN',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    optimizeDeps: {
      include: [
        /*
         * Pre-bundle all known client deps at startup to avoid runtime discovery + page reload.
         * Without this, Vite discovers ~40 deps during first page load, re-bundles, and forces a reload.
         *
         * React + React-DOM MUST be listed here so that all other pre-bundled deps share
         * the same React internals instead of inlining a separate copy.
         */
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'react-dnd',
        'react-dnd-html5-backend',
        '@ai-sdk/react',
        '@nanostores/react',
        'framer-motion',
        'react-toastify',
        'react-markdown',
        'react-resizable-panels',
        'react-window',
        'react-qrcode-logo',
        'react-chartjs-2',
        'class-variance-authority',
        'date-fns',
        'diff',
        'dompurify',
        'shiki',
        'chart.js',
        'file-saver',
        'jspdf',
        'jszip',
        'ignore',
        'istextorbinary',
        'js-cookie',
        'nanostores',
        'path-browserify',
        'mime',
        'rehype-raw',
        'rehype-sanitize',
        'remark-gfm',
        'unist-util-visit',
        'isomorphic-git',

        /* Radix UI */
        '@radix-ui/react-checkbox',
        '@radix-ui/react-collapsible',
        '@radix-ui/react-context-menu',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-label',
        '@radix-ui/react-popover',
        '@radix-ui/react-scroll-area',
        '@radix-ui/react-separator',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        '@radix-ui/react-tooltip',
        '@radix-ui/react-visually-hidden',

        /* CodeMirror */
        '@codemirror/autocomplete',
        '@codemirror/commands',
        '@codemirror/lang-cpp',
        '@codemirror/lang-css',
        '@codemirror/lang-html',
        '@codemirror/lang-javascript',
        '@codemirror/lang-json',
        '@codemirror/lang-markdown',
        '@codemirror/lang-python',
        '@codemirror/lang-sass',
        '@codemirror/lang-vue',
        '@codemirror/lang-wast',
        '@codemirror/language',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@uiw/codemirror-theme-vscode',
        '@lezer/highlight',

        /* Terminal */
        '@xterm/addon-fit',
        '@xterm/addon-web-links',
        '@xterm/xterm',
      ],
      exclude: ['undici'],
    },
  };
});
