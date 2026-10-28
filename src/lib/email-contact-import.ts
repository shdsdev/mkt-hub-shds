const supportedHeaders = new Set([
  "email",
  "email address",
  "full_name",
  "first name",
  "last name",
  "phone",
  "company",
  "tag",
  "tags",
  "subscription_status",
  "status",
  "subscription status",
  "consent_source",
  "consent source",
  "consented_at",
  "consent date",
  "timestamp opt",
  "unsubscribed_at",
]);

export type ImportedSubscriptionStatus = "subscribed" | "pending" | "unsubscribed" | "suppressed";

export type ParsedEmailContactRow = {
  rowNumber: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  attributes: Record<string, string>;
  subscriptionStatus?: ImportedSubscriptionStatus;
  consentSource?: string;
  consentedAt?: string;
  unsubscribedAt?: string;
  warnings?: string[];
};

export type ContactImportError = { rowNumber: number; message: string };
export type ParsedEmailContactCsv = { rows: ParsedEmailContactRow[]; errors: ContactImportError[] };

export function formatEmailImportSummary(input: { created: number; updated: number; failed: number }): string {
  const imported = input.created + input.updated;
  if (input.failed === 0) return `Importación terminada: ${imported} importados (${input.created} nuevos, ${input.updated} actualizados).`;
  return `Importación parcial: ${imported} importados (${input.created} nuevos, ${input.updated} actualizados) y ${input.failed} no importado${input.failed === 1 ? "" : "s"}.`;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim());
  return values;
}

function normalizeHeader(value: string): string { return value.replace(/^\uFEFF/, "").trim().toLowerCase(); }
function normalizeEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function firstIndex(headers: string[], aliases: string[]): number {
  return aliases.map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
}

function parseImportedStatus(value: string): ImportedSubscriptionStatus | null {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const aliases: Record<string, ImportedSubscriptionStatus> = {
    subscribed: "subscribed",
    suscrito: "subscribed",
    pending: "pending",
    pendiente: "pending",
    unsubscribed: "unsubscribed",
    unsubscribed_: "unsubscribed",
    "dado_de_baja": "unsubscribed",
    suppressed: "suppressed",
    suprimido: "suppressed",
  };
  return aliases[normalized] ?? null;
}

function parseImportedDate(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseEmailContactCsv(input: string): ParsedEmailContactCsv {
  const lines = input.replaceAll("\r\n", "\n").split("\n").filter((line, index, all) => line.trim() || index < all.length - 1);
  if (lines.length === 0) return { rows: [], errors: [{ rowNumber: 1, message: "El archivo está vacío." }] };
  const headers = parseCsvLine(lines[0] ?? "").map(normalizeHeader);
  const emailIndex = firstIndex(headers, ["email", "email address"]);
  if (emailIndex < 0) return { rows: [], errors: [{ rowNumber: 1, message: "El CSV debe incluir una columna email." }] };

  const rows: ParsedEmailContactRow[] = [];
  const errors: ContactImportError[] = [];
  const seenEmails = new Set<string>();
  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const values = parseCsvLine(line);
    const email = normalizeEmail(values[emailIndex] ?? "");
    if (!email) { errors.push({ rowNumber, message: "Email inválido." }); return; }
    if (seenEmails.has(email)) { errors.push({ rowNumber, message: "Email duplicado dentro del archivo." }); return; }
    seenEmails.add(email);
    const firstName = values[firstIndex(headers, ["first name"])]?.trim() ?? "";
    const lastName = values[firstIndex(headers, ["last name"])]?.trim() ?? "";
    const fullName = values[firstIndex(headers, ["full_name"])]?.trim() || [firstName, lastName].filter(Boolean).join(" ") || null;
    const rawTags = values[firstIndex(headers, ["tags", "tag"])]?.trim() ?? "";
    const tags = rawTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const statusValue = values[firstIndex(headers, ["subscription_status", "status", "subscription status"])]?.trim() ?? "";
    const consentSource = values[firstIndex(headers, ["consent_source", "consent source"])]?.trim() ?? "";
    const consentedAtValue = values[firstIndex(headers, ["consented_at", "consent date", "timestamp opt"])]?.trim() ?? "";
    const unsubscribedAtValue = values[firstIndex(headers, ["unsubscribed_at"])]?.trim() ?? "";
    const warnings: string[] = [];
    let subscriptionStatus: ImportedSubscriptionStatus | undefined;
    let consentedAt: string | undefined;
    let unsubscribedAt: string | undefined;

    if (statusValue) {
      subscriptionStatus = parseImportedStatus(statusValue) ?? undefined;
      if (!subscriptionStatus) {
        errors.push({ rowNumber, message: "Estado de suscripción inválido." });
        return;
      }
      if (subscriptionStatus === "subscribed") {
        consentedAt = parseImportedDate(consentedAtValue) ?? undefined;
        if (!consentSource || !consentedAt) {
          subscriptionStatus = "pending";
          consentedAt = undefined;
          warnings.push("El estado subscribed requiere consent_source y consented_at; se importará como pending.");
        }
      }
      if (subscriptionStatus === "unsubscribed") {
        unsubscribedAt = parseImportedDate(unsubscribedAtValue) ?? undefined;
      }
    }

    const attributes = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex]?.trim() ?? ""] as const).filter(([header, value]) => header && !supportedHeaders.has(header) && value));
    rows.push({
      rowNumber,
      email,
      fullName,
      phone: values[firstIndex(headers, ["phone"])]?.trim() || null,
      company: values[firstIndex(headers, ["company"])]?.trim() || null,
      tags,
      attributes,
      ...(subscriptionStatus ? { subscriptionStatus } : {}),
      ...(consentSource && subscriptionStatus === "subscribed" ? { consentSource } : {}),
      ...(consentedAt ? { consentedAt } : {}),
      ...(unsubscribedAt ? { unsubscribedAt } : {}),
      ...(warnings.length ? { warnings } : {}),
    });
  });
  return { rows, errors };
}
