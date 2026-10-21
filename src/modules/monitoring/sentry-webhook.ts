import { createHmac, timingSafeEqual } from "node:crypto";

export function hasValidSentrySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = Buffer.from(signature, "utf8");
  const calculated = Buffer.from(expected, "utf8");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export type SentryAlertPayload = {
  action?: string;
  data?: { issue?: { title?: string; level?: string; count?: string; userCount?: number; permalink?: string; culprit?: string } };
  issue_alert?: { title?: string };
  triggered_rule?: string;
};

export function formatSentryAlert(payload: SentryAlertPayload): string {
  const issue = payload.data?.issue;
  const severity = (issue?.level ?? "error").toUpperCase();
  const title = issue?.title ?? payload.issue_alert?.title ?? payload.triggered_rule ?? "Incidente sin título";
  const lines = [`[${severity}] Marketing HUB`, title];
  if (payload.action) lines.push(`Acción: ${payload.action}`);
  if (issue?.count) lines.push(`Ocurrencias: ${issue.count}`);
  if (issue?.userCount !== undefined) lines.push(`Usuarios afectados: ${issue.userCount}`);
  if (issue?.culprit) lines.push(`Módulo: ${issue.culprit}`);
  if (issue?.permalink) lines.push(`Ver en Sentry: ${issue.permalink}`);
  return lines.join("\n").slice(0, 3900);
}
