import { pgTable, pgEnum, uuid, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations, users } from "@/modules/users/db";

// Leaf module (design.md "Architecture Decisions" — notifications stays a leaf): no FK into
// `events`. The subject is identified generically (`subject_type`/`subject_id`) so this module
// never depends on the events schema, matching the public interface in design.md "Interfaces".
export const notificationSubjectType = pgEnum("notification_subject_type", ["event_attendee", "raffle_draw"]);
export const notificationType = pgEnum("notification_type", [
  "confirmation",
  "reminder",
  "waitlist_promotion",
  "registration_waitlisted",
  "registration_rejected",
  "winner_email",
]);
export const notificationStatus = pgEnum("notification_status", ["pending", "sent", "failed", "resent", "unknown"]);
export const internalNotificationType = pgEnum("internal_notification_type", [
  "registration_submitted",
  "registration_review_blocked",
  "registration_decision",
]);

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

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    recipientUserId: uuid("recipient_user_id").notNull().references(() => users.id),
    subjectId: uuid("subject_id").notNull(),
    type: internalNotificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_notifications_recipient_dedupe_unique").on(table.recipientUserId, table.dedupeKey)],
);

export const notificationsTables = {
  notificationSubjectType,
  notificationType,
  notificationStatus,
  notificationLog,
  userNotifications,
} as const;
