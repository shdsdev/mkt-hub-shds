import { eq, sql } from "drizzle-orm";
import { monitoringSettings } from "./db";

const GLOBAL_ID = "global";

async function getDb() {
  return (await import("@/db/client")).db;
}

export type MonitoringSettings = typeof monitoringSettings.$inferSelect;

export type MonitoringAlertType = "form_failure" | "performance";

type AlertPayload = {
  data?: {
    issue?: { tags?: Array<{ key?: string; value?: string }> };
    transaction?: { duration?: number };
  };
};

export function getMonitoringAlertType(payload: AlertPayload, thresholdMs = 3000): MonitoringAlertType {
  const tags = payload.data?.issue?.tags ?? [];
  if (tags.some((tag) => tag.key === "monitoring" && tag.value === "form_failure")) return "form_failure";
  if ((payload.data?.transaction?.duration ?? 0) >= thresholdMs) return "performance";
  return "form_failure";
}

export function isMonitoringAlertEnabled(settings: MonitoringSettings, type: MonitoringAlertType): boolean {
  return settings.enabled && (type === "form_failure" ? settings.formAlertsEnabled : settings.performanceAlertsEnabled);
}

export async function getMonitoringSettings(): Promise<MonitoringSettings> {
  const db = await getDb();
  const [settings] = await db.select().from(monitoringSettings).where(eq(monitoringSettings.id, GLOBAL_ID)).limit(1);
  return settings ?? {
    id: GLOBAL_ID,
    enabled: false,
    telegramChatId: null,
    formAlertsEnabled: true,
    performanceAlertsEnabled: true,
    slowOperationMs: 3000,
    updatedAt: new Date(0),
  };
}

export async function upsertMonitoringSettings(input: {
  enabled: boolean;
  telegramChatId: string | null;
  formAlertsEnabled: boolean;
  performanceAlertsEnabled: boolean;
  slowOperationMs: number;
}): Promise<MonitoringSettings> {
  const db = await getDb();
  const now = new Date();
  const [settings] = await db.insert(monitoringSettings)
    .values({ id: GLOBAL_ID, ...input, updatedAt: now })
    .onConflictDoUpdate({
      target: monitoringSettings.id,
      set: { ...input, updatedAt: now },
    })
    .returning();
  if (!settings) throw new Error("Monitoring settings could not be saved");
  return settings;
}

export async function checkDatabaseHealth(): Promise<void> {
  const db = await getDb();
  await db.execute(sql`select 1`);
}
