import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";

export const resourceStatus = pgEnum("resource_status", ["active", "disabled", "archived"]);
export const domainVerificationStatus = pgEnum("domain_verification_status", [
  "pending",
  "verified",
]);

export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  hostname: text("hostname").notNull().unique(),
  verificationStatus: domainVerificationStatus("verification_status").notNull().default("verified"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.organizationId, table.name)],
);

// destination + UTM live here ONLY (ARCHITECTURE.md I-1) — short_links/qr_codes hold a link_id
// FK and nothing else.
export const links = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  destinationUrl: text("destination_url").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  folderId: uuid("folder_id").references(() => folders.id),
  status: resourceStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const linkTags = pgTable(
  "link_tags",
  {
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.linkId, table.tagId] })],
);

export const shortLinks = pgTable(
  "short_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id),
    // CHECK ^[A-Za-z0-9_-]{3,64}$ enforced at the application layer (Zod) — see links/service.ts.
    slug: text("slug").notNull(),
    status: resourceStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.domainId, table.slug)],
);

export const linksTables = {
  resourceStatus,
  domainVerificationStatus,
  domains,
  folders,
  tags,
  links,
  linkTags,
  shortLinks,
} as const;
