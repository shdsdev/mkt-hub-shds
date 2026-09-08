import { pgTable, pgEnum, uuid, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";
import { links } from "@/modules/links/db";

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

export const campaignsTables = { campaignStatus, campaigns, campaignLinks } as const;
