import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { telegramSettings } from "./db";

export type TelegramSettings = typeof telegramSettings.$inferSelect;

export async function getTelegramSettings(organizationId: string): Promise<TelegramSettings | undefined> {
  const [settings] = await db
    .select()
    .from(telegramSettings)
    .where(eq(telegramSettings.organizationId, organizationId))
    .limit(1);
  return settings;
}

export async function upsertTelegramSettings(input: {
  organizationId: string;
  chatId: string | null;
  enabled: boolean;
  messageTemplate: string | null;
}): Promise<TelegramSettings> {
  const now = new Date();
  const [settings] = await db
    .insert(telegramSettings)
    .values({ ...input, updatedAt: now })
    .onConflictDoUpdate({
      target: telegramSettings.organizationId,
      set: { chatId: input.chatId, enabled: input.enabled, updatedAt: now },
    })
    .returning();
  if (!settings) throw new Error("Telegram settings could not be saved");
  return settings;
}

export async function resolveTelegramChatId(input: {
  organizationId: string;
  eventChatId?: string | null;
}): Promise<string | undefined> {
  const eventChatId = input.eventChatId?.trim();
  if (eventChatId) return eventChatId;

  const settings = await getTelegramSettings(input.organizationId);
  if (!settings?.enabled || !settings.chatId?.trim()) return undefined;
  return settings.chatId.trim();
}

export async function resolveTelegramMessageTemplate(input: {
  organizationId: string;
  eventTemplate?: string | null;
}): Promise<string | undefined> {
  const eventTemplate = input.eventTemplate?.trim();
  if (eventTemplate) return eventTemplate;
  const settings = await getTelegramSettings(input.organizationId);
  return settings?.messageTemplate?.trim() || undefined;
}
