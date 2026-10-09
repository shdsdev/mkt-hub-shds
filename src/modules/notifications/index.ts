// Public surface of the `notifications` module — the ONLY file other modules may import
// (ARCHITECTURE.md I-4). This PR (events-module PR1) lands only the schema (`db.ts`); the Resend
// adapter and `claimNotification`/`sendConfirmationEmail`/`sendReminderEmail`/
// `sendWaitlistPromotionEmail` functions land in PR2 (tasks.md 2.5-2.6) and get exported here then.
export {};
