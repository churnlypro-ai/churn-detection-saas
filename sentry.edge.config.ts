import * as Sentry from '@sentry/nextjs';

// Same as sentry.server.config.ts, but for code running on the Edge
// runtime — inert until SENTRY_DSN is set.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
