import { pgTable, pgEnum, uuid, text, integer, timestamp, primaryKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "@/modules/users/db";
import { links, shortLinks } from "@/modules/links/db";
import { qrCodes } from "@/modules/qr/db";

export const campaignStatus = pgEnum("campaign_status", ["active", "ended"]);

// Status never gates redirect resolution (ARCHITECTURE.md / SPEC.md §14) — a printed QR outlives
// the campaign that created it. This table only groups links for reporting.
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  status: campaignStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaignLinks = pgTable(
  "campaign_links",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.linkId] })],
);

// References exactly one of qr_code_id/short_link_id (DATABASE.md) — a physical print quantity
// against one specific asset. Never edited/deleted once recorded — it's historical record.
export const printRuns = pgTable(
  "print_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    qrCodeId: uuid("qr_code_id").references(() => qrCodes.id),
    shortLinkId: uuid("short_link_id").references(() => shortLinks.id),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "print_run_target_check",
      sql`(${table.qrCodeId} IS NOT NULL AND ${table.shortLinkId} IS NULL)
       OR (${table.qrCodeId} IS NULL AND ${table.shortLinkId} IS NOT NULL)`,
    ),
  ],
);

export const campaignsTables = { campaignStatus, campaigns, campaignLinks, printRuns } as const;
