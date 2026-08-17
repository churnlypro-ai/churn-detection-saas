import * as Sentry from '@sentry/nextjs';

// Sentry.init() is a documented no-op when `dsn` is falsy — this file is
// safe to ship even before a Sentry project exists. Set SENTRY_DSN (create
// a free project at sentry.io) to start receiving real error reports from
// the API routes and cron jobs, which is where this app's actual failure
// surface lives (analysis pipeline, Stripe webhooks, email sending).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
