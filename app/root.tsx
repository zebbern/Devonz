import * as Sentry from '@sentry/react';
import { useStore } from '@nanostores/react';
import type { LinksFunction } from 'react-router';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse } from 'react-router';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { lazy, Suspense, useEffect } from 'react';
import { useSentryUser } from './hooks/useSentryUser';
import { cssTransition, ToastContainer } from 'react-toastify';
import { supabase } from './lib/supabase.client';
import { updateAuth } from './lib/stores/auth';
import { updateProfile } from './lib/stores/profile';
import { getProfile } from './lib/api/user';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import liquidMetalStyles from './styles/liquid-metal.css?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

const DndWrapper = lazy(async () => {
  if (typeof window === 'undefined') {
    return { default: ({ children }: { children: React.ReactNode }) => <>{children}</> };
  }

  return import('./components/DndWrapper.client');
});

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  {
    rel: 'apple-touch-icon',
    href: '/apple-touch-icon.png',
  },
  {
    rel: 'manifest',
    href: '/manifest.json',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: liquidMetalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'dns-prefetch',
    href: 'https://cdn.simpleicons.org',
  },
  {
    rel: 'dns-prefetch',
    href: 'https://api.github.com',
  },
  {
    rel: 'dns-prefetch',
    href: 'https://api.netlify.com',
  },
  {
    rel: 'dns-prefetch',
    href: 'https://gitlab.com',
  },
  {
    rel: 'dns-prefetch',
    href: 'https://vercel.com',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('devonz_theme');

    if (!theme) {
      theme = 'dark';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useSentryUser();

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <meta name="theme-color" content="#0a0a0a" />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
      </head>
      <body>
        <noscript>
          <p style={{ padding: '2rem', color: '#fff', background: '#0a0a0a', textAlign: 'center' }}>
            JavaScript is required to use Devonz.
          </p>
        </noscript>
        <div id="root" className="w-full h-full">
          <Suspense fallback={<>{children}</>}>
            <DndWrapper>{children}</DndWrapper>
          </Suspense>
          <ToastContainer
            closeButton={({ closeToast }) => {
              return (
                <button className="Toastify__close-button" aria-label="Close notification" onClick={closeToast}>
                  <div className="i-ph:x text-lg" />
                </button>
              );
            }}
            icon={({ type }) => {
              switch (type) {
                case 'success': {
                  return <div className="i-ph:check-bold text-devonz-elements-icon-success text-2xl" />;
                }
                case 'error': {
                  return <div className="i-ph:warning-circle-bold text-devonz-elements-icon-error text-2xl" />;
                }
              }

              return undefined;
            }}
            position="bottom-right"
            pauseOnFocusLoss
            transition={toastAnimation}
            autoClose={3000}
          />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { logStore } from './lib/stores/logs';

export function SentryErrorBoundary() {
  const error = useRouteError();
  Sentry.captureException(error);

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-devonz-elements-background-depth-1 text-devonz-elements-textPrimary">
        <h1 className="text-4xl font-bold mb-4">
          {error.status} {error.statusText}
        </h1>
        <p className="text-devonz-elements-textSecondary">{error.data}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-devonz-elements-background-depth-1 text-devonz-elements-textPrimary">
      <h1 className="text-4xl font-bold mb-4">Unexpected Error</h1>
      <p className="text-devonz-elements-textSecondary">
        {error instanceof Error ? error.message : 'An unknown error occurred'}
      </p>
    </div>
  );
}

export { SentryErrorBoundary as ErrorBoundary };

function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Initialize debug logging with improved error handling
    import('./utils/debugLogger')
      .then(({ debugLogger }) => {
        /*
         * The debug logger initializes itself and starts disabled by default
         * It will only start capturing when enableDebugMode() is called
         */
        const status = debugLogger.getStatus();
        logStore.logSystem('Debug logging ready', {
          initialized: status.initialized,
          capturing: status.capturing,
          enabled: status.enabled,
        });
      })
      .catch((error) => {
        logStore.logError('Failed to initialize debug logging', error);
      });

    // Supabase Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      updateAuth({ session, user, isLoading: false });

      if (user) {
        getProfile(user.id).then((profile) => {
          if (profile) {
            updateProfile({
              name: profile.full_name || '',
              nickname: profile.username || '',
              email: user.email || '',
              avatar: profile.avatar_url || '',
            });
          }
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      updateAuth({ session, user, isLoading: false });

      if (user) {
        getProfile(user.id).then((profile) => {
          if (profile) {
            updateProfile({
              name: profile.full_name || '',
              nickname: profile.username || '',
              email: user.email || '',
              avatar: profile.avatar_url || '',
            });
          }
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-500 focus:text-white focus:rounded-lg"
      >
        Skip to content
      </a>
      <Sentry.ErrorBoundary
        showDialog={false}
        fallback={({ error, resetError }: { error: Error; resetError: () => void }) => (
          <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-devonz-elements-borderColor bg-devonz-elements-background-depth-2 text-center min-h-[200px]">
            <div className="i-ph:warning-circle-duotone text-4xl text-devonz-elements-button-danger-text mb-4" />
            <h3 className="text-lg font-medium text-devonz-elements-textPrimary mb-2">Application Error</h3>
            <p className="text-sm text-devonz-elements-textSecondary mb-4 max-w-md">An unexpected error occurred.</p>
            <div className="flex gap-2">
              <button
                onClick={resetError}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-devonz-elements-button-primary-background text-devonz-elements-button-primary-text hover:bg-devonz-elements-button-primary-backgroundHover transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && error instanceof Error && (
              <details className="mt-4 w-full max-w-lg text-left">
                <summary className="cursor-pointer text-sm text-devonz-elements-textTertiary hover:text-devonz-elements-textSecondary">
                  Error Details
                </summary>
                <div className="mt-2 p-3 bg-devonz-elements-background-depth-3 rounded-lg overflow-auto">
                  <p className="text-xs text-devonz-elements-textSecondary font-mono mb-2">
                    {error.name}: {error.message}
                  </p>
                  {error.stack && (
                    <pre className="text-xs text-devonz-elements-textTertiary whitespace-pre-wrap break-words">
                      {error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      >
        <Outlet />
      </Sentry.ErrorBoundary>
    </>
  );
}

export default App;
