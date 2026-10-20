import type { RegistrationTelegramMessage } from "./telegram";

export const DEFAULT_TELEGRAM_TEMPLATE =
  "Nuevo registro para {{evento}}\nHay una nueva solicitud pendiente de revisión. Revisá al candidato para decidir si puede asistir.";

export const TELEGRAM_TEMPLATE_TAGS = [
  "evento",
  "nombre",
  "email",
  "telefono",
  "empresa",
  "puesto",
  "ocupacion",
  "estado",
  "fecha_evento",
  "url_revision",
] as const;

export type TelegramTemplateTag = (typeof TELEGRAM_TEMPLATE_TAGS)[number];
export type TelegramTemplateValues = Partial<Record<TelegramTemplateTag, string>>;

const tagPattern = /{{\s*([^{}]+?)\s*}}/g;
const tagSet = new Set<string>(TELEGRAM_TEMPLATE_TAGS);

export function validateTelegramTemplate(template: string): string | undefined {
  for (const match of template.matchAll(tagPattern)) {
    const tag = match[1]?.trim() ?? "";
    if (!tagSet.has(tag)) return `La etiqueta {{${tag}}} no está disponible.`;
  }
  return undefined;
}

export function renderTelegramTemplate(template: string, values: TelegramTemplateValues): string {
  const error = validateTelegramTemplate(template);
  if (error) throw new Error(error);
  return template.replace(tagPattern, (_match, tag: string) => values[tag.trim() as TelegramTemplateTag] ?? "");
}

function canUseTelegramButtonUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function buildRegistrationTelegramMessage(input: {
  eventName: string;
  reviewUrl: string;
  template?: string | null;
  values?: TelegramTemplateValues;
}): RegistrationTelegramMessage {
  const reviewUrl = input.reviewUrl;
  const values: TelegramTemplateValues = {
    evento: input.eventName,
    url_revision: reviewUrl,
    ...input.values,
  };
  const text = renderTelegramTemplate(input.template?.trim() || DEFAULT_TELEGRAM_TEMPLATE, values);

  return {
    text,
    replyMarkup: {
      inline_keyboard: canUseTelegramButtonUrl(reviewUrl)
        ? [[{ text: "Revisar solicitud", url: reviewUrl }]]
        : [],
    },
  };
}
