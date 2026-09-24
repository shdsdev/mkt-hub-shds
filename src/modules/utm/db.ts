import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, users } from "@/modules/users/db";
import type { CustomParameter } from "./validation";

export const utmTemplateStatus = pgEnum("utm_template_status", ["active", "draft", "archived"]);

// Reusable organization-scoped UTM templates (the "/settings/utm" manager). Custom non-UTM pairs
// live separately from the standard UTM columns; standard values are normalized to snake_case on
// write, while historical rows keep their exact legacy bytes unchanged.
export const utmPresets = pgTable(
  "utm_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description"),
    utmSource: text("utm_source").notNull(),
    utmMedium: text("utm_medium").notNull(),
    utmCampaign: text("utm_campaign").notNull(),
    utmTerm: text("utm_term"),
    utmContent: text("utm_content"),
    utmId: text("utm_id"),
    customParameters: jsonb("custom_parameters")
      .$type<CustomParameter[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: utmTemplateStatus("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("utm_presets_organization_status_idx").on(table.organizationId, table.status),
    check("utm_presets_custom_parameters_check", sql`jsonb_typeof(${table.customParameters}) = 'array'`),
  ],
);

export const utmTables = { utmTemplateStatus, utmPresets } as const;
