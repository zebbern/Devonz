import { vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';

// Load environment variables from multiple files
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

export default defineConfig((config) => {
  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      target: 'esnext',
      rollupOptions: {
        // Externalize undici and util/types for client builds - these are server-only modules
        external: ['undici', 'util/types', 'node:util/types'],
        output: {
          manualChunks: {
            'vendor-codemirror': [
              '@codemirror/autocomplete',
              '@codemirror/commands',
              '@codemirror/language',
              '@codemirror/search',
              '@codemirror/state',
              '@codemirror/view',
            ],
            'vendor-ai': ['ai', '@ai-sdk/anthropic', '@ai-sdk/openai', '@ai-sdk/google'],
            'vendor-ui': [
              'framer-motion',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
            ],
            'vendor-syntax': ['shiki'],
          },
        },
      },
    },
    resolve: {
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
      ],
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        exclude: ['child_process', 'fs', 'path', 'stream'],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }

          return null;
        },
      },
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OPENAI_LIKE_API_MODELS',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/tests/preview/**', // Exclude preview tests that require Playwright
      ],
    },
    optimizeDeps: {
      exclude: ['undici'],
    },
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
