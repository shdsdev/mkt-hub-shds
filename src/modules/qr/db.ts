import { pgTable, pgEnum, uuid, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "@/modules/users/db";
import { links, shortLinks, folders, resourceStatus } from "@/modules/links/db";
import { campaigns } from "@/modules/campaigns/db";

export const qrMode = pgEnum("qr_mode", ["dynamic", "static"]);
export const qrErrorCorrectionLevel = pgEnum("qr_error_correction_level", [
  "L",
  "M",
  "Q",
  "H",
]);
// Descriptive only (list-page icon/label) — every static kind still stores its final encoded
// string in static_payload; this does not touch qr_mode_fields_check. NULL for dynamic rows.
export const qrStaticKind = pgEnum("qr_static_kind", ["text", "vcard", "email", "sms", "wifi"]);

// dotsOptions.type in qr-code-styling excludes 'dot' (singular) — corners include it. Two enums,
// not one, so the type system matches the library's actual constraints.
export const qrShapeType = pgEnum("qr_shape_type", [
  "square",
  "rounded",
  "dots",
  "classy",
  "classy-rounded",
  "extra-rounded",
]);
export const qrCornerType = pgEnum("qr_corner_type", [
  "square",
  "dot",
  "rounded",
  "dots",
  "classy",
  "classy-rounded",
  "extra-rounded",
]);

export const qrCodes = pgTable(
  "qr_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    mode: qrMode("mode").notNull(),
    // Organizational label, not encoded in the QR itself — required (backfilled for pre-existing
    // rows by the migration that adds this column, see drizzle/ for the exact UPDATE).
    name: text("name").notNull(),
    // Dynamic: both set, trackable, editable after print. Static: both null, untrackable by
    // design (DATABASE.md CHECK, mirrored below).
    linkId: uuid("link_id").references(() => links.id),
    shortLinkId: uuid("short_link_id").references(() => shortLinks.id),
    staticPayload: text("static_payload"),
    staticKind: qrStaticKind("static_kind"),
    // Cosmetic/export-time only — never affect redirect resolution (Phase 3 invariants).
    backgroundColor: text("background_color").notNull().default("#1c130f"),
    foregroundColor: text("foreground_color").notNull().default("#f7eeeb"),
    errorCorrectionLevel: qrErrorCorrectionLevel("error_correction_level").notNull().default("M"),
    dotsType: qrShapeType("dots_type").notNull().default("square"),
    cornersSquareType: qrCornerType("corners_square_type").notNull().default("square"),
    cornersDotType: qrCornerType("corners_dot_type").notNull().default("square"),
    logoUrl: text("logo_url"),
    // Where the QR is deployed (flyer/magazine/catalog photo) — distinct from logoUrl, which is
    // embedded inside the QR image itself.
    placementImageUrl: text("placement_image_url"),
    // Optional organizational grouping — either, not both in practice, but no CHECK enforces that
    // (a tag, not an invariant). Lives here (not only on `links`) so static QR codes, which have
    // no link_id, can be grouped too.
    folderId: uuid("folder_id").references(() => folders.id),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
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

// Applying a template only ever copies these seven design fields into client state — no FK from
// qr_codes back here, a template is a starting point to copy from, not a live relationship.
export const qrDesignTemplates = pgTable("qr_design_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  dotsType: qrShapeType("dots_type").notNull(),
  cornersSquareType: qrCornerType("corners_square_type").notNull(),
  cornersDotType: qrCornerType("corners_dot_type").notNull(),
  backgroundColor: text("background_color").notNull(),
  foregroundColor: text("foreground_color").notNull(),
  errorCorrectionLevel: qrErrorCorrectionLevel("error_correction_level").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const qrTables = {
  qrMode,
  qrErrorCorrectionLevel,
  qrStaticKind,
  qrShapeType,
  qrCornerType,
  qrCodes,
  qrDesignTemplates,
} as const;
