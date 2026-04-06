import { Buffer } from 'buffer';
import * as util from 'util';

if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).process = { env: { NODE_ENV: import.meta.env.MODE } };
  (window as any).util = util;
}

import * as Sentry from '@sentry/react';
import { HydratedRouter } from 'react-router/dom';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

const sentryDsn = import.meta.env.SENTRY_DSN;
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';
const release = import.meta.env.VITE_SENTRY_RELEASE || 'dev';
const isProduction = import.meta.env.PROD;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tunnel: '/api/sentry-tunnel',
    environment,
    release,
    enabled: !(import.meta.env.DEV && !sentryDsn),
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration({})],
  });
} else {
  console.warn('[Sentry] SENTRY_DSN not set — client-side error monitoring disabled.');
}

startTransition(() => {
  hydrateRoot(document, <HydratedRouter />);
});
