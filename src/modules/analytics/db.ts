import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  primaryKey,
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Composite PK required because of partitioning — the partition key must be part of the PK.
  (table) => [primaryKey({ columns: [table.id, table.createdAt] })],
);

export const analyticsTables = { trackingSourceType, trackingEvents } as const;
