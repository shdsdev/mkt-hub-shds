import { pgTable, pgEnum, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";
import { authUsers } from "@/db/auth-schema-ref";

export const userRole = pgEnum("user_role", [
  "ADMIN",
  "MARKETING_MANAGER",
  "MARKETING_USER",
  "VIEWER",
]);

export const userStatus = pgEnum("user_status", ["active", "disabled"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Profile table, not a credentials store (DATABASE.md) — `id` is a FK to Supabase's
// `auth.users.id`, not its own primary key generator. Supabase owns email/password.
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  role: userRole("role").notNull().default("MARKETING_USER"),
  status: userStatus("status").notNull().default("active"),
  // Account-level lockout (distinct from Supabase Auth's own per-IP rate limiting) — closes the
  // distributed-brute-force gap where many IPs each make a couple of attempts against one
  // account. See docs/SPEC.md §18.
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTables = {
  organizations,
  users,
  userRole,
  userStatus,
} as const;
