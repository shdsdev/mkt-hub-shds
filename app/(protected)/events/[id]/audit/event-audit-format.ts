export type AuditLogLike = {
  action: string;
  resourceType: string;
  before: unknown;
  after: unknown;
};

export type AuditChange = { label: string; from?: string; to?: string };
export type AuditSummary = { headline: string; changes: AuditChange[] };

const EVENT_FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  slug: "Enlace",
  status: "Estado",
  description: "Descripción",
  location: "Ubicación",
  locationUrl: "Enlace de ubicación",
  startsAt: "Inicio",
  endsAt: "Fin",
  capacity: "Capacidad",
  reminderOffsetMinutes: "Recordatorio",
  checkInConfirmationRequired: "Confirmación de check-in",
  collectCompany: "Campo empresa",
  collectJobTitle: "Campo puesto",
  heroImageUrl: "Imagen principal",
  agenda: "Agenda",
  sponsorLogos: "Patrocinadores",
  emailContent: "Correos",
  registrationFormConfig: "Formulario",
  telegramChatId: "Grupo de Telegram",
  telegramMessageTemplate: "Mensaje de Telegram",
  webhookUrl: "Webhook",
  webhookSecret: "Secreto del webhook",
  benefitRedemptionScope: "Alcance de beneficios",
};

const EMAIL_CONTENT_LABELS: Record<string, string> = {
  confirmationIntro: "Texto de confirmación",
  reminderIntro: "Texto de recordatorio",
  logistics: "Indicaciones de logística",
  benefit: "Texto de beneficios",
};

const FORM_FIELD_LABELS: Record<string, string> = {
  phone: "Teléfono",
  company: "Empresa",
  jobTitle: "Puesto",
  state: "Estado",
};

const KIND_LABELS: Record<string, string> = {
  confirmation: "la confirmación",
  replacement_invitation: "la invitación",
  decision: "la decisión",
  reminder: "el recordatorio",
  waitlist_promotion: "la promoción de lista de espera",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  closed: "Cerrado",
  archived: "Archivado",
};

const TECHNICAL_KEYS = new Set(["version", "customFieldsVersion", "created", "deleted", "secretRegenerated", "createdAt", "updatedAt", "id"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, max = 80): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "Vacío";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function formatDate(value: unknown): string {
  if (!(value instanceof Date) && typeof value !== "string") return "Vacío";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function formatMinutes(value: unknown): string {
  if (value === null || value === undefined) return "Sin recordatorio";
  if (typeof value !== "number") return String(value);
  if (value < 60) return `${value} min antes`;
  const hours = value / 60;
  if (hours < 24) return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h antes`;
  const days = hours / 24;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} días antes`;
}

function formatScalar(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    if (key === "capacity") return "Sin límite";
    return "Vacío";
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (key === "startsAt" || key === "endsAt") return formatDate(value);
  if (key === "reminderOffsetMinutes") return formatMinutes(value);
  if (key === "status") return STATUS_LABELS[String(value)] ?? String(value);
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "elemento" : "elementos"}`;
  if (typeof value === "object") return "Actualizado";
  return truncate(String(value));
}

function flattenEmailContent(value: Record<string, unknown>, prefix: string): AuditChange[] {
  return Object.entries(value)
    .filter(([key]) => !TECHNICAL_KEYS.has(key))
    .map(([key]) => ({ label: `${prefix}: ${EMAIL_CONTENT_LABELS[key] ?? key}`, to: formatScalar(key, value[key]) }));
}

function flattenFormConfig(value: Record<string, unknown>, prefix: string): AuditChange[] {
  const changes: AuditChange[] = [];
  const fields = value.fields;
  if (isRecord(fields)) {
    for (const [field, config] of Object.entries(fields)) {
      if (!isRecord(config)) continue;
      const fieldLabel = FORM_FIELD_LABELS[field] ?? field;
      for (const key of ["visible", "required"] as const) {
        if (!(key in config)) continue;
        const suffix = key === "visible" ? "visible" : "obligatorio";
        changes.push({ label: `${prefix}: ${fieldLabel} ${suffix}`, to: formatScalar(key, config[key]) });
      }
    }
  }
  if (isRecord(value.companion) && "enabled" in value.companion) {
    changes.push({ label: `${prefix}: Acompañantes`, to: formatScalar("enabled", value.companion.enabled) });
  }
  if (isRecord(value.interests)) {
    if ("enabled" in value.interests) changes.push({ label: `${prefix}: Intereses`, to: formatScalar("enabled", value.interests.enabled) });
    if (Array.isArray(value.interests.options)) changes.push({ label: `${prefix}: Intereses disponibles`, to: formatScalar("options", value.interests.options) });
  }
  if (isRecord(value.clientBrands)) {
    if ("enabled" in value.clientBrands) changes.push({ label: `${prefix}: Marcas`, to: formatScalar("enabled", value.clientBrands.enabled) });
    if (Array.isArray(value.clientBrands.options)) changes.push({ label: `${prefix}: Marcas disponibles`, to: formatScalar("options", value.clientBrands.options) });
  }
  if (isRecord(value.consent)) {
    for (const [key, config] of Object.entries(value.consent)) {
      if (!isRecord(config)) continue;
      for (const [prop, propValue] of Object.entries(config)) {
        changes.push({ label: `${prefix}: Consentimiento ${key} (${prop})`, to: formatScalar(prop, propValue) });
      }
    }
  }
  if (Array.isArray(value.customFields)) {
    changes.push({ label: `${prefix}: Campos personalizados`, to: formatScalar("customFields", value.customFields) });
  }
  return changes;
}

function formatField(key: string, value: unknown): string {
  if (key === "registrationFormConfig" && isRecord(value)) return "Configuración actualizada";
  return formatScalar(key, value);
}

function diffNested(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  flatten: (value: Record<string, unknown>, prefix: string) => AuditChange[],
  prefix: string,
): AuditChange[] {
  const prevChanges = flatten(prev, prefix);
  const nextChanges = flatten(next, prefix);
  if (nextChanges.length === 0) return prevChanges.map((change) => ({ label: change.label, from: change.to }));
  const changes: AuditChange[] = [];
  for (const nextChange of nextChanges) {
    const prevChange = prevChanges.find((change) => change.label === nextChange.label);
    if (prevChange?.to === nextChange.to) continue;
    changes.push({ label: nextChange.label, from: prevChange?.to, to: nextChange.to });
  }
  return changes;
}

function flattenEventChanges(before: Record<string, unknown>, after: Record<string, unknown>): AuditChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: AuditChange[] = [];
  for (const key of keys) {
    if (TECHNICAL_KEYS.has(key)) continue;
    const prev = before[key];
    const next = after[key];
    if (JSON.stringify(prev) === JSON.stringify(next)) continue;
    const label = EVENT_FIELD_LABELS[key] ?? key;

    if (key === "emailContent" && (isRecord(prev) || isRecord(next))) {
      changes.push(...diffNested(isRecord(prev) ? prev : {}, isRecord(next) ? next : {}, flattenEmailContent, label));
      continue;
    }

    if (key === "registrationFormConfig" && (isRecord(prev) || isRecord(next))) {
      changes.push(...diffNested(isRecord(prev) ? prev : {}, isRecord(next) ? next : {}, flattenFormConfig, label));
      continue;
    }

    changes.push({ label, from: formatField(key, prev), to: formatField(key, next) });
  }
  return changes;
}

function sendChanges(after: Record<string, unknown>): AuditChange[] {
  const changes: AuditChange[] = [];
  const kind = KIND_LABELS[String(after.kind ?? "")];
  if (kind) changes.push({ label: "Tipo", to: kind.replace(/^la |^el /, "") });
  if (typeof after.recipient === "string") changes.push({ label: "Destinatario", to: after.recipient });
  if (typeof after.result === "string") changes.push({ label: "Resultado", to: after.result === "sent" ? "Enviado" : "Fallido" });
  return changes;
}

function headlineFor(log: AuditLogLike, after: Record<string, unknown>): string {
  if (log.action === "event_send" || log.action === "event_send_failed") {
    const kind = KIND_LABELS[String(after.kind ?? "")] ?? "la notificación";
    const recipient = typeof after.recipient === "string" ? after.recipient : "el destinatario";
    return log.action === "event_send" ? `Envió ${kind} a ${recipient}` : `No se pudo enviar ${kind} a ${recipient}`;
  }
  if (log.resourceType === "event_webhook") return after.secretRegenerated ? "Regeneró el secreto del webhook" : "Actualizó el webhook";
  if (log.action === "event_attendee_update") return "Actualizó los datos de un asistente";
  if (log.action === "event_attendee_replace") return "Reemplazó a un asistente";
  if (log.action === "event_attendee_deactivate") return "Eliminó a un asistente";
  if (log.action === "event_primary_transfer") return "Transfirió la titularidad del registro";
  if (log.action === "event_change") {
    if (after.created === true) return "Creó el evento";
    if (after.deleted === true) return "Eliminó el evento";
    if (typeof after.status === "string" && after.status in STATUS_LABELS) return `Cambió el estado a ${STATUS_LABELS[after.status]}`;
    return "Editó el evento";
  }
  const resource = String(log.resourceType);
  if (resource === "event_editor") return log.before ? "Retiró a un editor" : "Asignó a un editor";
  if (resource === "event_receptionist") return log.before ? "Retiró a un miembro de recepción" : "Asignó a un miembro de recepción";
  if (resource === "event_benefit") return after.active === false ? "Desactivó un beneficio" : "Guardó un beneficio";
  if (resource === "event_benefit_redemption") return after.status === "annulled" ? "Anuló un canje de beneficio" : "Registró un canje de beneficio";
  if (resource === "event_check_in") return "Registró un check-in";
  if (resource === "event_attendee") return "Actualizó a un asistente";
  return "Actualizó el evento";
}

function legacyChanges(after: Record<string, unknown>): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const [key, value] of Object.entries(after)) {
    if (TECHNICAL_KEYS.has(key)) continue;
    const label = EVENT_FIELD_LABELS[key];
    if (!label) continue;
    const isEmptyValue = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (isEmptyValue && key !== "capacity" && key !== "reminderOffsetMinutes") continue;
    if (key === "registrationFormConfig" && isRecord(value)) {
      changes.push(...flattenFormConfig(value, label));
      continue;
    }
    if (key === "emailContent" && isRecord(value)) {
      changes.push(...flattenEmailContent(value, label));
      continue;
    }
    changes.push({ label, to: formatField(key, value) });
  }
  return changes.slice(0, 8);
}

export function summarizeAuditLog(log: AuditLogLike): AuditSummary {
  const before = isRecord(log.before) ? log.before : undefined;
  const after = isRecord(log.after) ? log.after : undefined;
  const headline = headlineFor(log, after ?? {});

  if (log.action === "event_send" || log.action === "event_send_failed") {
    return { headline, changes: after ? sendChanges(after) : [] };
  }

  const changes = before && after ? flattenEventChanges(before, after) : after ? legacyChanges(after) : [];
  return { headline, changes };
}
