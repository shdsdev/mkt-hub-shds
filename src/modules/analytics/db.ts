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
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";
import { links, shortLinks } from "@/modules/links/db";
import { qrCodes } from "@/modules/qr/db";
import { campaigns } from "@/modules/campaigns/db";

export const trackingSourceType = pgEnum("tracking_source_type", ["qr_scan", "link_click"]);
export const ga4DeliveryStatus = pgEnum("ga4_delivery_status", [
  "pending",
  "processing",
  "received",
  "failed",
  "uncertain",
  "cancelled",
]);

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
    // Normalized hostname of the HTTP Referer header (e.g. "instagram.com"), null when absent —
    // most QR scans have no Referer at all (opened from a camera app, not a browser). Displayed
    // as "Directo" when null, never as an empty string.
    referrer: text("referrer"),
    // ISO 3166-2 subdivision code from geoip-lite (e.g. "SLP", "TX"), shown raw/untranslated —
    // same convention as geo_country today. Null whenever geoip-lite can't resolve one.
    region: text("region"),
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

export const ga4EventOutbox = pgTable(
  "ga4_event_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackingEventId: uuid("tracking_event_id").notNull(),
    clientId: text("client_id").notNull(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    linkId: uuid("link_id").notNull().references(() => links.id),
    shortLinkId: uuid("short_link_id").references(() => shortLinks.id),
    sourceType: trackingSourceType("source_type").notNull(),
    status: ga4DeliveryStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("ga4_event_outbox_tracking_event_unique").on(table.trackingEventId),
    index("ga4_event_outbox_ready_idx").on(table.status, table.availableAt),
  ],
);

export const analyticsTables = { trackingSourceType, ga4DeliveryStatus, trackingEvents, trackingRollupDaily, ga4EventOutbox } as const;
