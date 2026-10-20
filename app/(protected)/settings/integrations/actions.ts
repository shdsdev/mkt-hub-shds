"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import {
  createPairingCode,
  renewHcsConnection,
  revokeHcsConnection,
} from "@/modules/integrations";
import {
  getTelegramSettings,
  sendTelegramMessage,
  upsertTelegramSettings,
  validateTelegramTemplate,
} from "@/modules/notifications";
import { isActive, isAdmin } from "@/modules/users";
import { env } from "@/lib/env";

const connectionSchema = z.object({ connectionId: z.string().uuid() });
const PERMISSION_ERROR = "No tienes permiso para administrar integraciones.";
const INVALID_FORM_ERROR = "La conexión seleccionada no es válida.";

export type HcsIntegrationActionState = {
  error?: string;
  success?: string;
  pairingCode?: string;
  expiresAt?: string;
  accessToken?: string;
  connectionId?: string;
  companyName?: string;
};

export type TelegramIntegrationActionState = {
  error?: string;
  success?: string;
};

async function requireActiveAdmin() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}

const telegramSettingsSchema = z.object({
  chatId: z.string().trim().max(100, "El chat ID es demasiado largo."),
  enabled: z.boolean(),
  messageTemplate: z.string().trim().max(3000, "La plantilla no puede superar 3000 caracteres."),
}).superRefine((value, context) => {
  if (value.enabled && !value.chatId) {
    context.addIssue({ code: "custom", path: ["chatId"], message: "Ingresá un chat ID para activar Telegram." });
  }
});

export async function saveTelegramSettingsAction(
  _state: TelegramIntegrationActionState,
  formData: FormData,
): Promise<TelegramIntegrationActionState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = telegramSettingsSchema.safeParse({
    chatId: formData.get("chatId") ?? "",
    enabled: formData.get("enabled") === "on",
    messageTemplate: formData.get("messageTemplate") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "La configuración no es válida." };
  const templateError = validateTelegramTemplate(parsed.data.messageTemplate);
  if (templateError) return { error: templateError };

  await upsertTelegramSettings({
    organizationId: user.profile.organizationId,
    chatId: parsed.data.chatId || null,
    enabled: parsed.data.enabled,
    messageTemplate: parsed.data.messageTemplate || null,
  });
  revalidatePath("/settings/integrations");
  return { success: "Configuración de Telegram guardada." };
}

export async function sendTelegramTestMessageAction(
  _state: TelegramIntegrationActionState,
): Promise<TelegramIntegrationActionState> {
  void _state;
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const settings = await getTelegramSettings(user.profile.organizationId);
  if (!settings?.enabled || !settings.chatId?.trim()) {
    return { error: "Activá Telegram y configurá un chat ID antes de enviar una prueba." };
  }

  try {
    await sendTelegramMessage({
      token: env.TELEGRAM_BOT_TOKEN,
      chatId: settings.chatId.trim(),
      text: "Mensaje de prueba de Marketing HUB. Telegram está conectado correctamente.",
      replyMarkup: { inline_keyboard: [] },
    });
    return { success: "Mensaje de prueba enviado correctamente." };
  } catch (error) {
    return {
      error: error instanceof Error
        ? `Telegram: ${error.message}`
        : "Telegram no aceptó el mensaje. Revisá el token y el chat ID.",
    };
  }
}

export async function generateHcsPairingCodeAction(
  _state: HcsIntegrationActionState,
): Promise<HcsIntegrationActionState> {
  void _state;
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const expiresAt = new Date(Date.now() + env.HCS_PAIRING_EXPIRY_MINUTES * 60_000);
  const result = await createPairingCode({ organizationId: user.profile.organizationId, expiresAt });
  return { pairingCode: result.code, expiresAt: expiresAt.toISOString() };
}

export async function revokeHcsConnectionAction(
  _state: HcsIntegrationActionState,
  formData: FormData,
): Promise<HcsIntegrationActionState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = connectionSchema.safeParse({ connectionId: formData.get("connectionId") });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const connection = await revokeHcsConnection({
    organizationId: user.profile.organizationId,
    connectionId: parsed.data.connectionId,
  });
  if (!connection) return { error: "La conexión no está disponible." };

  revalidatePath("/settings/integrations");
  return { success: "Conexión revocada." };
}

export async function renewHcsConnectionAction(
  _state: HcsIntegrationActionState,
  formData: FormData,
): Promise<HcsIntegrationActionState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = connectionSchema.safeParse({ connectionId: formData.get("connectionId") });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const expiresAt = new Date(Date.now() + env.HCS_CONNECTION_EXPIRY_DAYS * 86_400_000);
  try {
    const result = await renewHcsConnection({
      organizationId: user.profile.organizationId,
      connectionId: parsed.data.connectionId,
      expiresAt,
    });
    revalidatePath("/settings/integrations");
    return {
      success: "Token renovado. Guardalo ahora: no volverá a mostrarse.",
      accessToken: result.accessToken,
      connectionId: result.connection.id,
      companyName: result.connection.hcsCompanyName,
      expiresAt: expiresAt.toISOString(),
    };
  } catch {
    return { error: "La conexión no está disponible para renovar." };
  }
}
