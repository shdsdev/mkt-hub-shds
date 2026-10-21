import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  // Sentry's default is false; server events do not opt into PII.
  tracesSampleRate: 0.1,
});
