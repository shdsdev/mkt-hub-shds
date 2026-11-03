import { z } from "zod";
import { isHttpUrl, isInternationalPhone, normalizeInternationalPhone } from "./qr-content-validation";

const httpUrl = z.string().trim().refine(isHttpUrl, "La URL debe comenzar con http:// o https://.");
const internationalPhone = z.string().trim().refine(isInternationalPhone, "Usa un teléfono internacional válido con código de país.");
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const quickContentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), value: httpUrl }),
  z.object({ kind: z.literal("text"), value: z.string().trim().min(1, "Ingresa un texto.").max(2048) }),
  z.object({ kind: z.literal("whatsapp"), number: internationalPhone, message: optionalText(2000) }),
  z.object({ kind: z.literal("phone"), number: internationalPhone }),
  z.object({ kind: z.literal("email"), address: z.string().trim().email("Ingresa un email válido."), subject: optionalText(255), body: optionalText(2000) }),
  z.object({
    kind: z.literal("wifi"),
    ssid: z.string().trim().min(1, "Ingresa el nombre de la red.").max(64),
    password: z.string().max(128),
    security: z.enum(["WPA", "WEP", "nopass"]),
    hidden: z.boolean(),
  }).superRefine((value, context) => {
    if (value.security !== "nopass" && !value.password) {
      context.addIssue({ code: "custom", path: ["password"], message: "Ingresa la contraseña de la red." });
    }
  }),
  z.object({
    kind: z.literal("vcard"),
    fullName: z.string().trim().min(1, "Ingresa el nombre completo.").max(255),
    company: optionalText(255),
    phone: internationalPhone,
    email: z.string().trim().email("Ingresa un email válido."),
    website: optionalText(2048).refine((value) => !value || isHttpUrl(value), "El sitio web debe comenzar con http:// o https://."),
    address: optionalText(500),
  }),
]);

export type QuickContent = z.infer<typeof quickContentSchema>;

export function normalizePhone(value: string) {
  return normalizeInternationalPhone(value);
}

function escapeVCard(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n");
}

function escapeWifi(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/"/g, '\\"');
}

export function buildQuickPayload(input: QuickContent): string {
  switch (input.kind) {
    case "url":
    case "text":
      return input.value;
    case "whatsapp": {
      const message = input.message ? `?text=${encodeURIComponent(input.message)}` : "";
      return `https://wa.me/${normalizePhone(input.number)}${message}`;
    }
    case "phone":
      return `tel:+${normalizePhone(input.number)}`;
    case "email": {
      const params = new URLSearchParams();
      if (input.subject) params.set("subject", input.subject);
      if (input.body) params.set("body", input.body);
      const query = params.toString();
      return `mailto:${input.address}${query ? `?${query}` : ""}`;
    }
    case "wifi":
      return `WIFI:T:${input.security};S:${escapeWifi(input.ssid)};P:${escapeWifi(input.password)};H:${input.hidden};;`;
    case "vcard": {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${escapeVCard(input.fullName)}`,
        `TEL:${escapeVCard(input.phone)}`,
        `EMAIL:${escapeVCard(input.email)}`,
      ];
      if (input.company) lines.push(`ORG:${escapeVCard(input.company)}`);
      if (input.website) lines.push(`URL:${escapeVCard(input.website)}`);
      if (input.address) lines.push(`ADR:;;${escapeVCard(input.address)};;;`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
  }
}
