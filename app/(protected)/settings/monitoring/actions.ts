"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getMonitoringSettings, upsertMonitoringSettings } from "@/modules/monitoring";
import { sendTelegramMessage } from "@/modules/notifications";
import { env } from "@/lib/env";

const PERMISSION_ERROR = "No tienes permiso para administrar el monitoreo.";
const settingsSchema = z.object({
  enabled: z.boolean(),
  telegramChatId: z.string().trim().max(100, "El chat ID es demasiado largo."),
  formAlertsEnabled: z.boolean(),
  performanceAlertsEnabled: z.boolean(),
  slowOperationMs: z.coerce.number().int().min(1000).max(60000),
});

export type MonitoringActionState = { error?: string; success?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && isActive(user.profile) && isAdmin(user.profile) ? user : undefined;
}

export async function saveMonitoringSettingsAction(
  _state: MonitoringActionState,
  formData: FormData,
): Promise<MonitoringActionState> {
  const user = await requireAdmin();
  if (!user) return { error: PERMISSION_ERROR };
  const parsed = settingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    telegramChatId: formData.get("telegramChatId") ?? "",
    formAlertsEnabled: formData.get("formAlertsEnabled") === "on",
    performanceAlertsEnabled: formData.get("performanceAlertsEnabled") === "on",
    slowOperationMs: formData.get("slowOperationMs"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "La configuración no es válida." };
  if (parsed.data.enabled && !parsed.data.telegramChatId) return { error: "Ingresá un chat ID para activar las alertas." };

  await upsertMonitoringSettings({ ...parsed.data, telegramChatId: parsed.data.telegramChatId || null });
  revalidatePath("/settings/monitoring");
  return { success: "Configuración de monitoreo guardada." };
}

export async function sendMonitoringTestAction(_state: MonitoringActionState): Promise<MonitoringActionState> {
  void _state;
  const user = await requireAdmin();
  if (!user) return { error: PERMISSION_ERROR };
  const settings = await getMonitoringSettings();
  if (!settings.telegramChatId?.trim()) return { error: "Configurá el chat ID de alertas antes de probarlo." };
  try {
    await sendTelegramMessage({
      token: env.TELEGRAM_BOT_TOKEN,
      chatId: settings.telegramChatId.trim(),
      text: "[INFO] Marketing HUB: alerta de monitoreo de prueba. Telegram está conectado correctamente.",
      replyMarkup: { inline_keyboard: [] },
    });
    return { success: "Alerta de prueba enviada correctamente." };
  } catch (error) {
    return { error: error instanceof Error ? `Telegram: ${error.message}` : "Telegram rechazó la alerta de prueba." };
  }
}
