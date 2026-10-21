import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const monitoringSettings = pgTable("monitoring_settings", {
  id: text("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  telegramChatId: text("telegram_chat_id"),
  formAlertsEnabled: boolean("form_alerts_enabled").notNull().default(true),
  performanceAlertsEnabled: boolean("performance_alerts_enabled").notNull().default(true),
  slowOperationMs: integer("slow_operation_ms").notNull().default(3000),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
