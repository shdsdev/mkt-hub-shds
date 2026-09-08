import { pgTable, pgEnum, uuid, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "@/modules/users/db";
import { links, shortLinks, resourceStatus } from "@/modules/links/db";

export const qrMode = pgEnum("qr_mode", ["dynamic", "static"]);

export const qrCodes = pgTable(
  "qr_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    mode: qrMode("mode").notNull(),
    // Dynamic: both set, trackable, editable after print. Static: both null, untrackable by
    // design (DATABASE.md CHECK, mirrored below).
    linkId: uuid("link_id").references(() => links.id),
    shortLinkId: uuid("short_link_id").references(() => shortLinks.id),
    staticPayload: text("static_payload"),
    status: resourceStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "qr_mode_fields_check",
      sql`(${table.mode} = 'dynamic' AND ${table.linkId} IS NOT NULL AND ${table.shortLinkId} IS NOT NULL AND ${table.staticPayload} IS NULL)
       OR (${table.mode} = 'static' AND ${table.linkId} IS NULL AND ${table.shortLinkId} IS NULL AND ${table.staticPayload} IS NOT NULL)`,
    ),
  ],
);

export const qrTables = { qrMode, qrCodes } as const;
