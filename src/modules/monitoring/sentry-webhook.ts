import { createHmac, timingSafeEqual } from "node:crypto";

export function hasValidSentrySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = Buffer.from(signature, "utf8");
  const calculated = Buffer.from(expected, "utf8");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export type SentryTag = readonly [unknown, unknown] | { key?: unknown; value?: unknown };

type SentryAlertEvent = {
  title?: string;
  level?: string;
  count?: string;
  userCount?: number;
  culprit?: string;
  web_url?: string;
  url?: string;
  duration?: number;
  tags?: SentryTag[];
};

type SentryIssue = Omit<SentryAlertEvent, "web_url" | "url" | "duration" | "tags"> & {
  permalink?: string;
  tags?: SentryTag[];
};

export type SentryAlertPayload = {
  action?: string;
  data?: { event?: SentryAlertEvent; issue?: SentryIssue; transaction?: { duration?: number } };
  issue_alert?: { title?: string };
  triggered_rule?: string;
};

export function normalizeSentryTags(tags: unknown): Record<string, string> {
  if (!Array.isArray(tags)) return {};
  const normalized: Record<string, string> = {};
  for (const tag of tags) {
    if (Array.isArray(tag) && typeof tag[0] === "string" && typeof tag[1] === "string") {
      normalized[tag[0]] = tag[1];
      continue;
    }
    if (tag && typeof tag === "object" && "key" in tag && "value" in tag) {
      const key = tag.key;
      const value = tag.value;
      if (typeof key === "string" && typeof value === "string") normalized[key] = value;
    }
  }
  return normalized;
}

export function formatSentryAlert(payload: SentryAlertPayload): string {
  const issue = payload.data?.issue;
  const event = payload.data?.event;
  const severity = (event?.level ?? issue?.level ?? "error").toUpperCase();
  const title = event?.title ?? issue?.title ?? payload.issue_alert?.title ?? payload.triggered_rule ?? "Incidente sin título";
  const lines = [`[${severity}] Marketing HUB`, title];
  if (payload.action) lines.push(`Acción: ${payload.action}`);
  if (event?.count ?? issue?.count) lines.push(`Ocurrencias: ${event?.count ?? issue?.count}`);
  if (event?.userCount ?? issue?.userCount !== undefined) lines.push(`Usuarios afectados: ${event?.userCount ?? issue?.userCount}`);
  if (event?.culprit ?? issue?.culprit) lines.push(`Módulo: ${event?.culprit ?? issue?.culprit}`);
  const permalink = event?.web_url ?? event?.url ?? issue?.permalink;
  if (permalink) lines.push(`Ver en Sentry: ${permalink}`);
  return lines.join("\n").slice(0, 3900);
}
