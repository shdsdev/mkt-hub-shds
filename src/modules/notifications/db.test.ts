import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { notificationLog, notificationType, notificationStatus, notificationSubjectType, userNotifications, internalNotificationType } from "./db";

// Leaf-module schema contract (design.md "notifications" — generic subject, no FK into events).
describe("notifications schema (additive events-module migration, PR1)", () => {
  it("defines the notification type and status enums", () => {
    expect(notificationType.enumValues).toEqual(["confirmation", "reminder", "waitlist_promotion", "registration_waitlisted", "registration_rejected", "winner_email"]);
    expect(notificationStatus.enumValues).toEqual(["pending", "sent", "failed", "resent", "unknown"]);
    expect(notificationSubjectType.enumValues).toEqual(["event_attendee", "raffle_draw"]);
    expect(internalNotificationType.enumValues).toEqual(["registration_submitted", "registration_review_blocked", "registration_decision"]);
  });

  it("stores persistent notifications per recipient with a direct link", () => {
    expect(userNotifications.recipientUserId.notNull).toBe(true);
    expect(userNotifications.href.notNull).toBe(true);
    expect(userNotifications.readAt.notNull).toBe(false);
  });

  it("scopes notification_log to an organization", () => {
    expect(notificationLog.organizationId.notNull).toBe(true);
  });

  it("identifies the subject generically, not via a foreign key into events", () => {
    expect(notificationLog.subjectType.notNull).toBe(true);
    expect(notificationLog.subjectId.notNull).toBe(true);
  });

  it("defaults status to pending and tracks provider message id / error", () => {
    expect(notificationLog.status.default).toBe("pending");
    expect(notificationLog.providerMessageId.notNull).toBe(false);
    expect(notificationLog.error.notNull).toBe(false);
  });

  it("enforces UNIQUE(subject_id, notification_type) for idempotent claims", () => {
    const { uniqueConstraints } = getTableConfig(notificationLog);
    const match = uniqueConstraints.find((constraint) =>
      constraint.columns.map((column) => column.name).sort().join(",") ===
      ["subject_id", "notification_type"].sort().join(","),
    );
    expect(match).toBeDefined();
  });
});
