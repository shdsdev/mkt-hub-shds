"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { createEvent, updateEvent, setEventStatus } from "@/modules/events";

const PERMISSION_ERROR = "No tienes permiso para administrar eventos.";
const INVALID_FORM_ERROR = "Revisa los datos del evento.";
const NOT_FOUND_ERROR = "El evento no está disponible.";

// Same gate shape as app/(protected)/settings/users/actions.ts#requireActiveAdmin — duplicated
// per module rather than shared, matching this repo's existing convention.
async function requireActiveAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}

// `datetime-local` input values ("2026-11-01T18:00") parse fine via `z.coerce.date()`.
const optionalInt = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number.parseInt(value, 10) : null))
  .refine((value) => value === null || Number.isInteger(value), "Debe ser un número entero.");

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
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  capacity: optionalInt,
  reminderOffsetMinutes: optionalInt,
});

export type EventFormState = { error?: string; success?: string; eventId?: string };

function readEventFields(formData: FormData) {
  return {
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    capacity: formData.get("capacity") || undefined,
    reminderOffsetMinutes: formData.get("reminderOffsetMinutes") || undefined,
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
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    capacity: parsed.data.capacity,
    reminderOffsetMinutes: parsed.data.reminderOffsetMinutes,
  });
  if (!result.ok) return { error: PERMISSION_ERROR };

  revalidatePath("/events");
  return { success: "Evento creado.", eventId: result.event.id };
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
    actorRole: user.profile.role,
    changes: {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      location: parsed.data.location || undefined,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      capacity: parsed.data.capacity,
      reminderOffsetMinutes: parsed.data.reminderOffsetMinutes,
    },
  });
  if (!result.ok) return { error: result.reason === "not_found" ? NOT_FOUND_ERROR : PERMISSION_ERROR };

  revalidatePath("/events");
  revalidatePath(`/events/${id.data}/edit`);
  return { success: "Evento actualizado." };
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
