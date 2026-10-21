import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  formatSentryAlert,
  getMonitoringAlertType,
  getMonitoringSettings,
  hasValidSentrySignature,
  isMonitoringAlertEnabled,
  type SentryAlertPayload,
} from "@/modules/monitoring";
import { sendTelegramMessage } from "@/modules/notifications";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!hasValidSentrySignature(rawBody, request.headers.get("sentry-hook-signature"), env.SENTRY_ALERTS_CLIENT_SECRET)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: SentryAlertPayload;
  try {
    payload = JSON.parse(rawBody) as SentryAlertPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const settings = await getMonitoringSettings();
  if (!settings.enabled || !settings.telegramChatId) return NextResponse.json({ error: "Monitoring disabled" }, { status: 404 });
  const alertType = getMonitoringAlertType(payload as Parameters<typeof getMonitoringAlertType>[0], settings.slowOperationMs);
  if (!isMonitoringAlertEnabled(settings, alertType)) return NextResponse.json({ error: "Alert disabled" }, { status: 404 });
  try {
    await sendTelegramMessage({
      token: env.TELEGRAM_BOT_TOKEN,
      chatId: settings.telegramChatId,
      text: formatSentryAlert(payload),
      replyMarkup: { inline_keyboard: [] },
    });
  } catch {
    return NextResponse.json({ error: "Telegram delivery failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
