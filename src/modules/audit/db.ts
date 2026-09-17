import { pgTable, pgEnum, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";
import { authUsers } from "@/db/auth-schema-ref";

export const auditAction = pgEnum("audit_action", [
  "create",
  "destination_change",
  "archive",
  "end_campaign",
  "record_print_run",
  "invite_user",
  "change_user_role",
  "disable_user",
  "reactivate_user",
]);

// Append-only (no update/delete function anywhere in this module) — matches the print_runs
// pattern (Phase 6). `before`/`after` are only populated where relevant (destination_change).
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id),
  action: auditAction("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditTables = { auditAction, auditLogs } as const;
