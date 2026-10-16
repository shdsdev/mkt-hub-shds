import { pgTable, pgEnum, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";

// Leaf module (design.md "Architecture Decisions" — notifications stays a leaf): no FK into
// `events`. The subject is identified generically (`subject_type`/`subject_id`) so this module
// never depends on the events schema, matching the public interface in design.md "Interfaces".
export const notificationSubjectType = pgEnum("notification_subject_type", ["event_attendee", "raffle_draw"]);
export const notificationType = pgEnum("notification_type", [
  "confirmation",
  "reminder",
  "waitlist_promotion",
  "winner_email",
]);
export const notificationStatus = pgEnum("notification_status", ["pending", "sent", "failed", "resent", "unknown"]);

// UNIQUE(subject_id, notification_type) is the idempotency guard (design.md "Reminder
// idempotency"): `claimNotification` claims work with INSERT ... ON CONFLICT DO NOTHING RETURNING
// id, so duplicate webhook pings or retries never produce a second send for the same subject+type.
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    subjectType: notificationSubjectType("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    notificationType: notificationType("notification_type").notNull(),
    status: notificationStatus("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [unique("notification_log_subject_type_unique").on(table.subjectId, table.notificationType)],
);

export const notificationsTables = {
  notificationSubjectType,
  notificationType,
  notificationStatus,
  notificationLog,
} as const;
