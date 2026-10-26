"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_EVENT_REMINDER_OFFSET_MINUTES } from "@/lib/events/event-reminder";
import { parseDateTimeLocal } from "@/lib/events/event-date-time";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { validateTelegramTemplate } from "@/modules/notifications";
import { isActive, isAdmin } from "@/modules/users";
import { eventEmailContentSchema } from "@/lib/events/event-email-content";
import {
  createEvent,
  updateEvent,
  setEventStatus,
  archiveEvent,
  restoreEvent,
  deleteEvent,
  setEventWebhookUrl,
  regenerateEventWebhookSecret,
  registrationFormConfigSchema,
} from "@/modules/events";

const PERMISSION_ERROR = "No tienes permiso para administrar eventos.";
const INVALID_FORM_ERROR = "Revisa los datos del evento.";
const NOT_FOUND_ERROR = "El evento no está disponible.";
const UNSAFE_WEBHOOK_URL_ERROR =
  "Esa URL no es válida para un webhook — debe ser https:// y apuntar a una dirección pública.";

// Same gate shape as app/(protected)/settings/users/actions.ts#requireActiveAdmin — duplicated
// per module rather than shared, matching this repo's existing convention.
async function requireActiveAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}

async function requireActiveEventManager() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isActive(user.profile) || (!isAdmin(user.profile) && user.profile.role !== "EVENT_EDITOR")) return undefined;
  return user;
}

const eventDateTimeField = z.string().trim().min(1).transform((value, context) => {
  try {
    return parseDateTimeLocal(value);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha y hora del evento no son válidas." });
    return z.NEVER;
  }
});

const optionalInt = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number.parseInt(value, 10) : null))
  .refine((value) => value === null || Number.isInteger(value), "Debe ser un número entero.");

// Landing content model: the client-side form keeps agenda/sponsorLogos as array state and
// serializes the current array into a hidden input's JSON string on every render (same "form
// owns a structured value via one hidden input" shape as collectCompany's "true"/"" pattern, just
// carrying a list instead of a boolean). An empty/absent field means "no items", not "field
// omitted" — the edit form always renders this hidden input, so there is no clearable-vs-absent
// distinction to make here the way there is for description/location.
function jsonArrayField<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return [];
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "JSON inválido." });
        return z.NEVER;
      }
    })
    .pipe(z.array(itemSchema));
}

const registrationFormConfigField = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    try {
      return JSON.parse(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Configuración inválida." });
      return z.NEVER;
    }
  })
  .pipe(registrationFormConfigSchema);

const eventEmailContentField = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    try {
      return JSON.parse(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Configuración inválida." });
      return z.NEVER;
    }
  })
  .pipe(eventEmailContentSchema);

const agendaItemSchema = z.object({
  time: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional(),
});

const sponsorLogoSchema = z.object({
  url: z.string().trim().url().max(2000),
  name: z.string().trim().max(255).optional(),
});

const eventFieldsSchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones."),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  location: z.string().trim().max(255).optional().or(z.literal("")),
  locationUrl: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    }, "La URL debe usar http o https.")
    .optional()
    .or(z.literal("")),
  startsAt: eventDateTimeField,
  endsAt: eventDateTimeField.optional(),
  capacity: optionalInt,
  reminderOffsetMinutes: optionalInt,
  checkInConfirmationRequired: z.coerce.boolean().default(true),
  // spec.md "Fixed Optional Field Catalog" — hidden-input "true"/"" pattern matching
  // app/(protected)/qr/qr-design-fields.tsx's `saveAsTemplate` convention.
  collectCompany: z.coerce.boolean().default(false),
  collectJobTitle: z.coerce.boolean().default(false),
  heroImageUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
  agenda: jsonArrayField(agendaItemSchema),
  sponsorLogos: jsonArrayField(sponsorLogoSchema),
  registrationFormConfig: registrationFormConfigField.optional(),
  emailContent: eventEmailContentField.optional(),
  telegramChatId: z.string().trim().max(100).optional().or(z.literal("")),
});

export type EventFormState = { error?: string; success?: string; eventId?: string };

function readEventFields(formData: FormData) {
  return {
    // `??` (not `||`) for name/slug/startsAt: a field key absent from the submitted form (e.g.
    // the edit form never renders a `slug` input — see event-edit-form.tsx) makes
    // `formData.get(...)` return `null`, which `eventFieldsSchema.partial(...)` does NOT treat as
    // "omitted" the way it treats `undefined` — `z.string()` rejects an explicit `null`. Using `??`
    // normalizes the missing-key case to `undefined` so the partial schema accepts it.
    name: formData.get("name") ?? undefined,
    slug: formData.get("slug") ?? undefined,
    // `??` (not `||`) here specifically so an explicitly-submitted empty string stays "" instead
    // of collapsing to `undefined` (verify-report W2) — `updateEventAction` below needs to tell
    // "field submitted empty, clear it" (`""`) apart from "field key absent" (`undefined`).
    description: formData.get("description") ?? undefined,
    location: formData.get("location") ?? undefined,
    locationUrl: formData.get("locationUrl") ?? undefined,
    startsAt: formData.get("startsAt") ?? undefined,
    // Normalize an empty optional end timestamp before schema parsing. updateEventAction checks
    // the raw FormData separately when an existing value must be cleared.
    endsAt: formData.get("endsAt") === "" ? undefined : formData.get("endsAt") ?? undefined,
    // Empty optional numeric fields mean "no value" rather than a clearable null.
    capacity: formData.get("capacity") || undefined,
    reminderOffsetMinutes: formData.get("reminderOffsetMinutes") || undefined,
    checkInConfirmationRequired: formData.get("checkInConfirmationRequired"),
    collectCompany: formData.get("collectCompany"),
    collectJobTitle: formData.get("collectJobTitle"),
    heroImageUrl: formData.get("heroImageUrl") ?? undefined,
    agenda: formData.get("agenda") ?? undefined,
    sponsorLogos: formData.get("sponsorLogos") ?? undefined,
    registrationFormConfig: formData.get("registrationFormConfig") ?? undefined,
    emailContent: formData.get("emailContent") ?? undefined,
    telegramChatId: formData.get("telegramChatId") ?? undefined,
  };
}

export async function createEventAction(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = eventFieldsSchema.safeParse(readEventFields(formData));
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const result = await createEvent({
    organizationId: user.profile.organizationId,
    actorRole: user.profile.role,
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description || undefined,
    location: parsed.data.location || undefined,
    locationUrl: parsed.data.locationUrl || undefined,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt || undefined,
    capacity: parsed.data.capacity,
    reminderOffsetMinutes: parsed.data.reminderOffsetMinutes ?? DEFAULT_EVENT_REMINDER_OFFSET_MINUTES,
    collectCompany: parsed.data.collectCompany,
    collectJobTitle: parsed.data.collectJobTitle,
    heroImageUrl: parsed.data.heroImageUrl || undefined,
    agenda: parsed.data.agenda,
    sponsorLogos: parsed.data.sponsorLogos,
    registrationFormConfig: parsed.data.registrationFormConfig,
    emailContent: parsed.data.emailContent,
    telegramChatId: parsed.data.telegramChatId || undefined,
  });
  if (!result.ok) return { error: PERMISSION_ERROR };

  revalidatePath("/events");
  redirect(`/events/${result.event.id}/dashboard`);
}

const updateEventFieldsSchema = eventFieldsSchema.partial({ name: true, slug: true, startsAt: true });

export async function updateEventAction(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: INVALID_FORM_ERROR };

  const parsed = updateEventFieldsSchema.safeParse(readEventFields(formData));
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const result = await updateEvent({
    id: id.data,
    organizationId: user.profile.organizationId,
    actorId: user.id,
    actorRole: user.profile.role,
    changes: {
      name: parsed.data.name,
      // verify-report W2: when the field key WAS submitted (not `undefined`) but empty, map to
      // explicit `null` so `updateEvent`'s `.set()` actually clears the stored value instead of
      // Drizzle silently skipping an `undefined` key and leaving the old value in place.
      description:
        parsed.data.description === undefined ? undefined : parsed.data.description || null,
      location: parsed.data.location === undefined ? undefined : parsed.data.location || null,
      locationUrl: parsed.data.locationUrl === undefined ? undefined : parsed.data.locationUrl || null,
      startsAt: parsed.data.startsAt,
      endsAt: formData.get("endsAt") === "" ? null : parsed.data.endsAt,
      capacity: parsed.data.capacity,
      reminderOffsetMinutes: formData.has("reminderOffsetMinutes")
        ? parsed.data.reminderOffsetMinutes
        : undefined,
      checkInConfirmationRequired: parsed.data.checkInConfirmationRequired,
      collectCompany: parsed.data.collectCompany,
      collectJobTitle: parsed.data.collectJobTitle,
      heroImageUrl:
        parsed.data.heroImageUrl === undefined ? undefined : parsed.data.heroImageUrl || null,
      agenda: parsed.data.agenda,
      sponsorLogos: parsed.data.sponsorLogos,
      emailContent: parsed.data.emailContent,
      registrationFormConfig: parsed.data.registrationFormConfig,
      telegramChatId: parsed.data.telegramChatId === undefined ? undefined : parsed.data.telegramChatId || null,
    },
  });
  if (!result.ok) return { error: result.reason === "not_found" ? NOT_FOUND_ERROR : PERMISSION_ERROR };

  revalidatePath("/events");
  revalidatePath(`/events/${id.data}/edit`);
  return { success: "Evento actualizado." };
}

export async function saveEventTelegramChatIdAction(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireActiveEventManager();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = z.object({
    id: z.string().uuid(),
    telegramChatId: z.string().trim().max(100).optional().or(z.literal("")),
  }).safeParse({
    id: formData.get("id"),
    telegramChatId: formData.get("telegramChatId") ?? undefined,
  });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const result = await updateEvent({
    id: parsed.data.id,
    organizationId: user.profile.organizationId,
    actorId: user.id,
    actorRole: user.profile.role,
    changes: { telegramChatId: parsed.data.telegramChatId || null },
  });
  if (!result.ok) return { error: result.reason === "not_found" ? NOT_FOUND_ERROR : PERMISSION_ERROR };

  revalidatePath("/events");
  revalidatePath(`/events/${parsed.data.id}/edit`);
  return { success: "Grupo de Telegram guardado." };
}

export async function saveEventTelegramMessageTemplateAction(
  _prevState: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const user = await requireActiveEventManager();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = z.object({
    id: z.string().uuid(),
    template: z.string().trim().max(3000, "La plantilla no puede superar 3000 caracteres."),
  }).safeParse({
    id: formData.get("id"),
    template: formData.get("template") ?? "",
  });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };
  const templateError = validateTelegramTemplate(parsed.data.template);
  if (templateError) return { error: templateError };

  const result = await updateEvent({
    id: parsed.data.id,
    organizationId: user.profile.organizationId,
    actorId: user.id,
    actorRole: user.profile.role,
    changes: { telegramMessageTemplate: parsed.data.template || null },
  });
  if (!result.ok) return { error: result.reason === "not_found" ? NOT_FOUND_ERROR : PERMISSION_ERROR };

  revalidatePath("/events");
  revalidatePath(`/events/${parsed.data.id}/edit`);
  return { success: "Mensaje de Telegram guardado." };
}

async function setStatusAction(formData: FormData, status: "published" | "closed"): Promise<void> {
  const user = await requireActiveAdmin();
  if (!user) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const result = await setEventStatus({
    id: id.data,
    organizationId: user.profile.organizationId,
    actorRole: user.profile.role,
    status,
  });
  if (!result.ok) return;

  revalidatePath("/events");
  revalidatePath(`/events/${id.data}/edit`);
}

export async function publishEventAction(formData: FormData): Promise<void> {
  return setStatusAction(formData, "published");
}

export async function closeEventAction(formData: FormData): Promise<void> {
  return setStatusAction(formData, "closed");
}

async function lifecycleAction(
  formData: FormData,
  operation: typeof archiveEvent,
): Promise<void> {
  const user = await requireActiveAdmin();
  if (!user) return;
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const result = await operation({ id: id.data, organizationId: user.profile.organizationId, actorRole: user.profile.role });
  if (!result.ok) return;
  revalidatePath("/events");
  revalidatePath(`/events/${id.data}`);
  revalidatePath(`/events/${id.data}/dashboard`);
  revalidatePath(`/events/${id.data}/edit`);
}

export async function archiveEventAction(formData: FormData): Promise<void> {
  return lifecycleAction(formData, archiveEvent);
}

export async function restoreEventAction(formData: FormData): Promise<void> {
  return lifecycleAction(formData, restoreEvent);
}

export async function deleteEventAction(_prevState: EventFormState, formData: FormData): Promise<EventFormState> {
  const user = await requireActiveEventManager();
  if (!user) return { error: PERMISSION_ERROR };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: NOT_FOUND_ERROR };
  const result = await deleteEvent({ id: id.data, organizationId: user.profile.organizationId, actorRole: user.profile.role });
  if (!result.ok) {
    if (result.reason === "has_registrations") return { error: "No se puede eliminar un evento con registros." };
    return { error: result.reason === "not_found" ? NOT_FOUND_ERROR : PERMISSION_ERROR };
  }
  revalidatePath("/events");
  revalidatePath(`/events/${id.data}`);
  revalidatePath(`/events/${id.data}/dashboard`);
  revalidatePath(`/events/${id.data}/edit`);
  return { success: "Evento eliminado." };
}

const webhookUrlSchema = z.object({
  id: z.string().uuid(),
  webhookUrl: z.string().trim().url().max(2000).optional().or(z.literal("")),
});

export type WebhookFormState = { error?: string; success?: string; webhookSecret?: string };

// Admin feedback round ("poder generar un webhook por evento"). A separate form/action from
// updateEventAction on purpose: setEventWebhookUrl owns the "generate the secret exactly once"
// logic, which a plain UpdateEventChanges passthrough would not.
export async function setWebhookAction(
  _prevState: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  const user = await requireActiveEventManager();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = webhookUrlSchema.safeParse({
    id: formData.get("id"),
    webhookUrl: formData.get("webhookUrl"),
  });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const result = await setEventWebhookUrl({
    id: parsed.data.id,
    organizationId: user.profile.organizationId,
    actorId: user.id,
    actorRole: user.profile.role,
    webhookUrl: parsed.data.webhookUrl || null,
  });
  if (!result.ok) {
    if (result.reason === "not_found") return { error: NOT_FOUND_ERROR };
    if (result.reason === "unsafe_url") return { error: UNSAFE_WEBHOOK_URL_ERROR };
    return { error: PERMISSION_ERROR };
  }

  revalidatePath(`/events/${parsed.data.id}/edit`);
  return { success: "Webhook actualizado.", webhookSecret: result.event.webhookSecret ?? undefined };
}

export async function regenerateWebhookSecretAction(
  _prevState: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: INVALID_FORM_ERROR };

  const result = await regenerateEventWebhookSecret({
    id: id.data,
    organizationId: user.profile.organizationId,
    actorRole: user.profile.role,
  });
  if (!result.ok) return { error: result.reason === "not_found" ? NOT_FOUND_ERROR : PERMISSION_ERROR };

  revalidatePath(`/events/${id.data}/edit`);
  return { success: "Secreto regenerado.", webhookSecret: result.event.webhookSecret ?? undefined };
}
