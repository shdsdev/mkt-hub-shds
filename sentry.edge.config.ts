import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  // Sentry's default is false; edge events do not opt into PII.
  tracesSampleRate: 0.1,
});
