// Single place that reads process.env — fails fast with a named error instead of a cryptic
// driver crash when a required variable is missing.
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get NEXT_PUBLIC_SUPABASE_URL() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  // Shared secret the external cron-job.org webhook presents as `Authorization: Bearer <value>`
  // against `app/api/jobs/event-reminders/route.ts` (design.md "Reminder trigger"). Read only
  // through this getter — never raw `process.env` — so a missing secret fails fast with a named
  // error instead of silently accepting every request (unlike the out-of-scope `jobs/rollup`
  // route this module explicitly does not imitate on that point).
  get EVENTS_REMINDER_JOB_SECRET() {
    return required("EVENTS_REMINDER_JOB_SECRET");
  },
  get RESEND_API_KEY() {
    return required("RESEND_API_KEY");
  },
  get RESEND_FROM() {
    return required("RESEND_FROM");
  },
  get NEXT_PUBLIC_APP_ORIGIN() {
    return required("NEXT_PUBLIC_APP_ORIGIN");
  },
};
