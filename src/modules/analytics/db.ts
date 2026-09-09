import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";
import { links, shortLinks } from "@/modules/links/db";
import { qrCodes } from "@/modules/qr/db";
import { campaigns } from "@/modules/campaigns/db";

export const trackingSourceType = pgEnum("tracking_source_type", ["qr_scan", "link_click"]);

// Partitioned by created_at (DATABASE.md) — drizzle-kit can't express PARTITION BY, so the
// generated migration's CREATE TABLE is hand-edited to add it plus the first partition. This
// declaration is for typed queries; it is NOT the source of the physical partitioning.
export const trackingEvents = pgTable(
  "tracking_events",
  {
    id: uuid("id").notNull().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id),
    shortLinkId: uuid("short_link_id").references(() => shortLinks.id),
    qrCodeId: uuid("qr_code_id").references(() => qrCodes.id),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    sourceType: trackingSourceType("source_type").notNull(),
    isBot: boolean("is_bot").notNull().default(false),
    visitorHash: text("visitor_hash").notNull(),
    sessionStartedAt: timestamp("session_started_at", { withTimezone: true }).notNull(),
    deviceType: text("device_type"),
    geoCountry: text("geo_country"),
    geoCity: text("geo_city"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Composite PK required because of partitioning — the partition key must be part of the PK.
  (table) => [primaryKey({ columns: [table.id, table.createdAt] })],
);

// Kept indefinitely after raw tracking_events are dropped (DATABASE.md) — no visitor_hash/IP
// columns here, by design.
export const trackingRollupDaily = pgTable(
  "tracking_rollup_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id),
    date: date("date").notNull(),
    clicksHuman: integer("clicks_human").notNull().default(0),
    clicksBot: integer("clicks_bot").notNull().default(0),
    scansHuman: integer("scans_human").notNull().default(0),
    scansBot: integer("scans_bot").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.linkId, table.date)],
);

export const analyticsTables = { trackingSourceType, trackingEvents, trackingRollupDaily } as const;
