import { pgTable, text, timestamp, uuid, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";

export const hcsPairingCodes = pgTable("hcs_pairing_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hcsConnections = pgTable(
  "hcs_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    hcsCompanyId: text("hcs_company_id").notNull(),
    hcsCompanyName: text("hcs_company_name").notNull(),
    hcsRequestedByUserId: text("hcs_requested_by_user_id"),
    hcsRequestedByEmail: text("hcs_requested_by_email"),
    accessTokenHash: text("access_token_hash").notNull(),
    accessTokenPrefix: text("access_token_prefix").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("hcs_connections_organization_company_unique").on(table.organizationId, table.hcsCompanyId)],
);

export const integrationIdempotencyRecords = pgTable(
  "integration_idempotency_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id").notNull().references(() => hcsConnections.id),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("integration_idempotency_connection_operation_key_unique").on(table.connectionId, table.operation, table.key)],
);

export const integrationsTables = {
  hcsPairingCodes,
  hcsConnections,
  integrationIdempotencyRecords,
} as const;
