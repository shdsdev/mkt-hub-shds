// Single place that reads process.env — fails fast with a named error instead of a cryptic
// driver crash when a required variable is missing.
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
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
  get MARKETING_HUB_SERVER_TOKEN() {
    return required("MARKETING_HUB_SERVER_TOKEN");
  },
  get HCS_PAIRING_EXPIRY_MINUTES() {
    return positiveInteger("HCS_PAIRING_EXPIRY_MINUTES", 15);
  },
  get HCS_CONNECTION_EXPIRY_DAYS() {
    return positiveInteger("HCS_CONNECTION_EXPIRY_DAYS", 90);
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
