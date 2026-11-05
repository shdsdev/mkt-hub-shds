"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth";
import { isAdmin } from "@/modules/users";
import { assignEmailTags, createEmailContact, createEmailTag, previewEventContactSync, removeEmailTag, sendEmailRepermission, subscribeEmailContacts, syncEventContactRecords, updateEmailContact } from "@/modules/email-marketing";
import { parseEmailContactCsv, type ContactImportError } from "@/modules/email-marketing";
import { formatEmailImportSummary } from "@/lib/email-contact-import";
import { listRegistrationContactsForEmailSync } from "@/modules/events";

const tagSchema = z.object({ name: z.string().trim().min(1).max(80) });
const contactSchema = z.object({
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  tag: z.string().trim().max(80).optional().or(z.literal("")),
});
const assignmentSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
  tagIds: z.array(z.string().uuid()).min(1),
});
const bulkContactIdsSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
});
const contactUpdateSchema = contactSchema.extend({ contactId: z.string().uuid() });
const contactTagSchema = z.object({ contactId: z.string().uuid(), tagId: z.string().uuid() });

export type ContactActionState = { error?: string; success?: string; created?: number; updated?: number; errors?: ContactImportError[]; warnings?: number };
export type EventContactSyncActionState = {
  error?: string;
  success?: string;
  preview?: boolean;
  summary?: Awaited<ReturnType<typeof previewEventContactSync>>;
  selectedEventIds?: string[];
};

function contactPath(contactId: string) {
  return `/email-marketing/contacts/${contactId}`;
}

export async function updateEmailContactAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await authorizedUser();
  if (!user) return { error: "No tienes permisos para editar contactos." };
  const parsed = contactUpdateSchema.safeParse({
    contactId: formData.get("contactId"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    tag: "",
  });
  if (!parsed.success) return { error: "Revisa el email y los datos del contacto." };
  try {
    const contact = await updateEmailContact({ organizationId: user.profile.organizationId, ...parsed.data });
    if (!contact) return { error: "No se encontró el contacto dentro de tu organización." };
    revalidatePath(contactPath(contact.id));
    revalidatePath("/email-marketing/contacts");
    return { success: "Datos del contacto actualizados." };
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return { error: "Ya existe otro contacto con ese correo electrónico." };
    }
    console.error("Failed to update email contact", { contactId: parsed.data.contactId, error });
    return { error: "No se pudieron guardar los cambios. Revisa los datos e intenta nuevamente." };
  }
}

export async function assignEmailContactTagAction(formData: FormData): Promise<void> {
  const user = await authorizedUser();
  const parsed = contactTagSchema.safeParse({ contactId: formData.get("contactId"), tagId: formData.get("tagId") });
  if (!user || !parsed.success) return;
  await assignEmailTags({ organizationId: user.profile.organizationId, contactIds: [parsed.data.contactId], tagIds: [parsed.data.tagId] });
  revalidatePath(contactPath(parsed.data.contactId));
}

export async function removeEmailContactTagAction(formData: FormData): Promise<void> {
  const user = await authorizedUser();
  const parsed = contactTagSchema.safeParse({ contactId: formData.get("contactId"), tagId: formData.get("tagId") });
  if (!user || !parsed.success) return;
  await removeEmailTag({ organizationId: user.profile.organizationId, ...parsed.data });
  revalidatePath(contactPath(parsed.data.contactId));
}

function authorizedUser() {
  return getCurrentUser().then((user) => user && isAdmin(user.profile) ? user : undefined);
}

export async function syncEventContactsAction(
  _previous: EventContactSyncActionState,
  formData: FormData,
): Promise<EventContactSyncActionState> {
  const user = await authorizedUser();
  if (!user) return { error: "No tienes permisos para sincronizar contactos." };
  const eventIds = formData.getAll("eventIds").map(String).filter(Boolean);
  const selectedEventIds = eventIds.length > 0 ? eventIds : undefined;
  try {
    const records = await listRegistrationContactsForEmailSync({
      organizationId: user.profile.organizationId,
      eventIds: selectedEventIds,
    });
    const normalizedRecords = records.map((record) => ({ ...record, registrationId: record.registrationId }));
    const summary = formData.get("confirm") === "true"
      ? await syncEventContactRecords(normalizedRecords)
      : await previewEventContactSync(normalizedRecords);
    revalidatePath("/email-marketing/contacts");
    return formData.get("confirm") === "true"
      ? { summary, selectedEventIds: eventIds, success: `Sincronización completada: ${summary.newContacts} nuevos y ${summary.existingContacts} existentes.` }
      : { summary, selectedEventIds: eventIds, preview: true };
  } catch (error) {
    console.error("Failed to synchronize event contacts", { organizationId: user.profile.organizationId, error });
    return { error: "No se pudieron sincronizar los registros de eventos." };
  }
}

export async function createEmailContactAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await authorizedUser();
  if (!user) return { error: "No tienes permisos para administrar contactos." };
  const parsed = contactSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    tag: formData.get("tag"),
  });
  if (!parsed.success) return { error: "Ingresa un email válido y revisa los datos del contacto." };

  try {
    const contact = await createEmailContact({
      organizationId: user.profile.organizationId,
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      company: parsed.data.company,
      source: "manual",
    });
    if (parsed.data.tag) {
      const tag = await createEmailTag({ organizationId: user.profile.organizationId, name: parsed.data.tag });
      await assignEmailTags({ organizationId: user.profile.organizationId, contactIds: [contact.contactId], tagIds: [tag.id] });
    }
    revalidatePath("/email-marketing/contacts");
    revalidatePath("/email-marketing/campaigns/new");
    return { success: contact.created ? "Contacto creado como pendiente." : "Contacto actualizado; su estado se conservó." };
  } catch {
    return { error: "No se pudo guardar el contacto." };
  }
}

export async function importEmailContactsAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await authorizedUser();
  if (!user) return { error: "No tienes permisos para importar contactos." };
  const csv = String(formData.get("csv") ?? "");
  const parsed = parseEmailContactCsv(csv);
  if (parsed.rows.length === 0) return { error: parsed.errors[0]?.message ?? "El CSV no contiene contactos válidos.", errors: parsed.errors };

  let created = 0;
  let updated = 0;
  let warnings = 0;
  const errors = [...parsed.errors];
  for (const row of parsed.rows) {
    try {
      const contact = await createEmailContact({
        organizationId: user.profile.organizationId,
        email: row.email,
        fullName: row.fullName,
        phone: row.phone,
        company: row.company,
        attributes: row.attributes,
        subscriptionStatus: row.subscriptionStatus,
        consentSource: row.consentSource,
        consentedAt: row.consentedAt,
        unsubscribedAt: row.unsubscribedAt,
        source: "csv_import",
      });
      if (row.warnings?.length) warnings += 1;
      if (contact.created) created += 1;
      else updated += 1;
      if (row.tags.length > 0) {
        const tags = await Promise.all(row.tags.map((name) => createEmailTag({ organizationId: user.profile.organizationId, name })));
        await assignEmailTags({ organizationId: user.profile.organizationId, contactIds: [contact.contactId], tagIds: tags.map((tag) => tag.id) });
      }
    } catch (error) {
      console.error("Failed to import email contact row", {
        rowNumber: row.rowNumber,
        email: row.email,
        error,
      });
      errors.push({ rowNumber: row.rowNumber, message: "No se pudo guardar el contacto." });
    }
  }

  revalidatePath("/email-marketing/contacts");
  revalidatePath("/email-marketing/campaigns/new");
  const summary = formatEmailImportSummary({ created, updated, failed: errors.length });
  return { success: warnings ? `${summary} ${warnings} filas quedaron como pending por falta de evidencia.` : summary, created, updated, errors, warnings };
}

export async function createEmailTagAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.profile)) return { error: "No tienes permisos para administrar etiquetas." };
  const parsed = tagSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Ingresa un nombre de etiqueta válido." };
  try {
    await createEmailTag({ organizationId: user.profile.organizationId, name: parsed.data.name });
    revalidatePath("/email-marketing/contacts");
    revalidatePath("/email-marketing/campaigns/new");
    return { success: "Etiqueta creada." };
  } catch {
    return { error: "La etiqueta ya existe o no pudo crearse." };
  }
}

export async function assignEmailTagsAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.profile)) return { error: "No tienes permisos para asignar etiquetas." };
  const parsed = assignmentSchema.safeParse({
    contactIds: JSON.parse(String(formData.get("contactIds") ?? "[]")),
    tagIds: JSON.parse(String(formData.get("tagIds") ?? "[]")),
  });
  if (!parsed.success) return { error: "Selecciona contactos y una etiqueta." };
  await assignEmailTags({ organizationId: user.profile.organizationId, ...parsed.data });
  revalidatePath("/email-marketing/contacts");
  revalidatePath("/email-marketing/segments");
  revalidatePath("/email-marketing/campaigns/new");
  return { success: "Etiqueta asignada a los contactos seleccionados." };
}

export async function subscribeEmailContactsAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.profile)) return { error: "No tienes permisos para administrar contactos." };
  const parsed = bulkContactIdsSchema.safeParse({
    contactIds: JSON.parse(String(formData.get("contactIds") ?? "[]")),
  });
  if (!parsed.success) return { error: "Selecciona al menos un contacto." };
  const updated = await subscribeEmailContacts({ organizationId: user.profile.organizationId, contactIds: parsed.data.contactIds });
  revalidatePath("/email-marketing/contacts");
  revalidatePath("/email-marketing/campaigns/new");
  return { success: `${updated} ${updated === 1 ? "contacto suscrito" : "contactos suscritos"}.` };
}

export async function sendEmailRepermissionAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.profile)) return { error: "No tienes permisos para solicitar consentimiento." };
  let contactIds: string[];
  try {
    contactIds = z.array(z.string().uuid()).min(1).max(100).parse(JSON.parse(String(formData.get("contactIds") ?? "[]")));
  } catch {
    return { error: "Selecciona entre 1 y 100 contactos pendientes." };
  }

  let sent = 0;
  let skipped = 0;
  for (const contactId of contactIds) {
    const result = await sendEmailRepermission({ organizationId: user.profile.organizationId, contactId });
    if (result.sent) sent += 1;
    else skipped += 1;
  }
  revalidatePath("/email-marketing/contacts");
  return { success: `${sent} solicitud${sent === 1 ? " enviada" : "s enviadas"}.${skipped ? ` ${skipped} contacto${skipped === 1 ? " omitido" : "s omitidos"} por no estar pendiente.` : ""}` };
}
