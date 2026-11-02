import { createHash, randomBytes } from "node:crypto";
import type { EmailContactStatus } from "./service";

export function createRepermissionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRepermissionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isRepermissionContactEligible(status: EmailContactStatus): boolean {
  return status === "pending";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export function renderRepermissionEmailHtml(input: {
  recipientName: string | null;
  confirmUrl: string;
  declineUrl: string;
  logoUrl: string;
}): string {
  const name = escapeHtml(input.recipientName?.trim() || "equipo");
  const confirmUrl = escapeHtml(input.confirmUrl);
  const declineUrl = escapeHtml(input.declineUrl);
  const logoUrl = escapeHtml(input.logoUrl);
  return `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>¿Seguimos en contacto?</title></head>
<body style="margin:0;padding:0;background:#f4f3ef;font-family:Arial,Helvetica,sans-serif;color:#242424;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dcdad3;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 32px;background:#242424;"><img src="${logoUrl}" alt="Shades de México" width="160" style="display:block;width:160px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>
<tr><td style="height:4px;background:#66cdcc;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:38px 32px 20px;"><p style="margin:0 0 18px;font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#5c5c5c;">Actualización de preferencias</p><h1 style="margin:0 0 18px;font-size:32px;line-height:1.15;font-weight:500;color:#242424;">¿Seguimos en contacto?</h1><p style="margin:0;font-size:16px;line-height:1.7;color:#5c5c5c;">Hola, ${name}. Queremos confirmar si deseás recibir novedades, recursos y comunicaciones de Shades de México.</p></td></tr>
<tr><td style="padding:18px 32px 34px;"><a href="${confirmUrl}" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#66cdcc;color:#242424;text-decoration:none;font-weight:700;">Sí, quiero recibir novedades</a><p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#5c5c5c;">Si preferís no recibirlas, <a href="${declineUrl}" style="color:#242424;text-decoration:underline;">podés darte de baja aquí</a>.</p></td></tr>
<tr><td style="padding:22px 32px;background:#242424;color:#f4f3ef;font-size:12px;line-height:1.6;">Este mensaje solo solicita actualizar tus preferencias. No contiene una oferta promocional.</td></tr>
</table></td></tr></table></body></html>`;
}
