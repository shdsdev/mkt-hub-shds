"use server";

import { z } from "zod";
import {
  getPublishedEventBySlugPublic,
  registerForEvent,
  notifyEventWebhook,
  OCCUPATION_OPTIONS,
  resolveRegistrationFormConfig,
  type AttendeeInput,
} from "@/modules/events";
import { sendConfirmationEmail } from "@/modules/notifications";
import { exportQrPng } from "@/modules/qr";

const EVENT_UNAVAILABLE_ERROR = "Este evento ya no está disponible.";
const INVALID_FORM_ERROR = "Revisa tus datos de contacto.";
const INVALID_COMPANION_ERROR = "Revisa los datos de tus acompañantes.";
const DUPLICATE_EMAIL_ERROR = "Ya existe un registro activo con este correo para este evento.";
const INVALID_CONSENT_ERROR = "Acepta la política de privacidad y los términos para continuar.";
const INVALID_BRANDS_ERROR = "Revisa las marcas seleccionadas.";
const INVALID_INTERESTS_ERROR = "Revisa tus intereses seleccionados.";
const TOO_MANY_COMPANIONS_ERROR = "Solo puedes registrar un acompañante.";
const INVALID_OCCUPATION_ERROR = "Seleccioná tu actividad profesional para continuar.";
const INVALID_COMPANION_OCCUPATION_ERROR = "Seleccioná la actividad del acompañante para continuar.";
const INVALID_BRAND_COMBINATION_ERROR = "Seleccioná una sola opción: Ninguno o una marca.";

const attendeeSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  company: z.string().trim().max(255).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(255).optional().or(z.literal("")),
  occupation: z.enum(OCCUPATION_OPTIONS),
});

export type RegisterFormState = { error?: string; success?: boolean; status?: "confirmed" | "waitlisted" };

function normalizeAttendee(parsed: z.infer<typeof attendeeSchema>): AttendeeInput {
  return {
    fullName: parsed.fullName,
    email: parsed.email,
    phone: parsed.phone || undefined,
    company: parsed.company || undefined,
    jobTitle: parsed.jobTitle || undefined,
  };
}

function isAccepted(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "true" || value === "on";
}

function readSelectedOptions(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String).filter(Boolean);
}

function validateConfiguredFields(
  attendee: z.infer<typeof attendeeSchema>,
  fields: { phone: { visible: boolean; required: boolean }; company: { visible: boolean; required: boolean }; jobTitle: { visible: boolean; required: boolean } },
): string | undefined {
  const requiredFields = [
    ["phone", attendee.phone, fields.phone, "El teléfono"],
    ["company", attendee.company, fields.company, "La empresa"],
    ["jobTitle", attendee.jobTitle, fields.jobTitle, "El puesto"],
  ] as const;

  for (const [, value, field, label] of requiredFields) {
    if (field.required && !value?.trim()) return `${label} es obligatorio.`;
  }
  return undefined;
}

function normalizeConfiguredAttendee(
  parsed: z.infer<typeof attendeeSchema>,
  fields: { phone: { visible: boolean; required: boolean }; company: { visible: boolean; required: boolean }; jobTitle: { visible: boolean; required: boolean } },
): AttendeeInput {
  const normalized = normalizeAttendee(parsed);
  return {
    ...normalized,
    phone: fields.phone.visible ? normalized.phone : undefined,
    company: fields.company.visible ? normalized.company : undefined,
    jobTitle: fields.jobTitle.visible ? normalized.jobTitle : undefined,
    occupation: parsed.occupation,
  };
}

// Companions are submitted as same-name repeated inputs (register-form.tsx renders one row per
// companion) — `FormData.getAll` preserves submission order, so zipping by index pairs each
// companion's fields back together. A row with neither name nor email filled in is treated as an
// unused/removed row, not a validation error.
function readCompanions(formData: FormData): unknown[] {
  const fullNames = formData.getAll("companionFullName").map(String);
  const emails = formData.getAll("companionEmail").map(String);
  const phones = formData.getAll("companionPhone").map(String);
  const companies = formData.getAll("companionCompany").map(String);
  const jobTitles = formData.getAll("companionJobTitle").map(String);
  const occupations = formData.getAll("companionOccupation").map(String);

  const rowCount = Math.max(fullNames.length, emails.length, phones.length, companies.length, jobTitles.length, occupations.length);
  return Array.from({ length: rowCount }, (_, index) => ({
      fullName: fullNames[index] ?? "",
      email: emails[index] ?? "",
      phone: phones[index] ?? "",
      company: companies[index] ?? "",
      jobTitle: jobTitles[index] ?? "",
      occupation: occupations[index] ?? "",
    }))
    .filter((companion) => companion.fullName.trim() || companion.email.trim());
}

function readUtm(formData: FormData) {
  return {
    utmSource: (formData.get("utmSource") as string) || undefined,
    utmMedium: (formData.get("utmMedium") as string) || undefined,
    utmCampaign: (formData.get("utmCampaign") as string) || undefined,
    utmTerm: (formData.get("utmTerm") as string) || undefined,
    utmContent: (formData.get("utmContent") as string) || undefined,
    utmId: (formData.get("utmId") as string) || undefined,
  };
}

// spec.md "Public landing" registration entrypoint. The event is re-resolved server-side from
// `slug` (never trusts a client-supplied eventId/eventName) — this both re-enforces the "draft is
// never publicly reachable" rule at submission time and gives `eventName` an authoritative source
// for the confirmation email, matching getPublishedEventBySlugPublic's own org/status scoping.
export async function registerForEventAction(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim()) {
    return { success: true, status: "confirmed" };
  }

  const slug = formData.get("slug");
  if (typeof slug !== "string" || !slug) return { error: EVENT_UNAVAILABLE_ERROR };

  const event = await getPublishedEventBySlugPublic(slug);
  if (!event) return { error: EVENT_UNAVAILABLE_ERROR };
  const formConfig = resolveRegistrationFormConfig(event);
  const occupation = formData.get("occupation");
  if (typeof occupation !== "string" || !OCCUPATION_OPTIONS.includes(occupation as never)) {
    return { error: INVALID_OCCUPATION_ERROR };
  }

  const primaryParsed = attendeeSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? undefined,
    company: formData.get("company") ?? undefined,
    jobTitle: formData.get("jobTitle") ?? undefined,
    occupation: formData.get("occupation") ?? "",
  });
  if (!primaryParsed.success) return { error: INVALID_FORM_ERROR };
  const primaryFieldError = validateConfiguredFields(primaryParsed.data, formConfig.fields);
  if (primaryFieldError) return { error: primaryFieldError };

  const companionInputs = readCompanions(formData);
  if (companionInputs.length > 1) return { error: TOO_MANY_COMPANIONS_ERROR };
  if (companionInputs.length > 0 && !formConfig.companion.enabled) return { error: INVALID_COMPANION_ERROR };
  const firstCompanion = companionInputs[0] as { occupation?: unknown } | undefined;
  if (firstCompanion && !OCCUPATION_OPTIONS.includes(String(firstCompanion.occupation) as never)) {
    return { error: INVALID_COMPANION_OCCUPATION_ERROR };
  }
  const companionsParsed = z.array(attendeeSchema).safeParse(companionInputs);
  if (!companionsParsed.success) return { error: INVALID_COMPANION_ERROR };
  if (companionsParsed.data[0]) {
    const companionFieldError = validateConfiguredFields(companionsParsed.data[0], formConfig.fields);
    if (companionFieldError) return { error: companionFieldError.replace(/^El |^La /, "El acompañante: ") };
  }

  if (!isAccepted(formData, "privacyAccepted") || !isAccepted(formData, "termsAccepted")) {
    return { error: INVALID_CONSENT_ERROR };
  }

  const clientBrands = readSelectedOptions(formData, "clientBrands");
  if (clientBrands.includes("none") && clientBrands.length > 1) return { error: INVALID_BRAND_COMBINATION_ERROR };
  if (!formConfig.clientBrands.enabled && clientBrands.length > 0) return { error: INVALID_BRANDS_ERROR };
  if (clientBrands.some((option) => !formConfig.clientBrands.options.some((allowed) => allowed === option))) {
    return { error: INVALID_BRANDS_ERROR };
  }

  const interests = readSelectedOptions(formData, "interests");
  if (!formConfig.interests.enabled && interests.length > 0) return { error: INVALID_INTERESTS_ERROR };
  if (interests.some((option) => !formConfig.interests.options.some((allowed) => allowed === option))) {
    return { error: INVALID_INTERESTS_ERROR };
  }

  const now = new Date();
  const marketingAccepted = isAccepted(formData, "marketingAccepted");

  const result = await registerForEvent({
    eventId: event.id,
    source: "public",
    primary: normalizeConfiguredAttendee(primaryParsed.data, formConfig.fields),
    companions: companionsParsed.data.map((companion) => normalizeConfiguredAttendee(companion, formConfig.fields)),
    clientBrands,
    interests,
    requestedMoreCompanions: isAccepted(formData, "requestMoreCompanions"),
    consents: {
      privacyAcceptedAt: now,
      termsAcceptedAt: now,
      ...(formConfig.consent.marketing.enabled && marketingAccepted ? { marketingAcceptedAt: now } : {}),
    },
    utm: readUtm(formData),
  });

  if (!result.ok) {
    return { error: result.reason === "duplicate_email" ? DUPLICATE_EMAIL_ERROR : EVENT_UNAVAILABLE_ERROR };
  }

  // Fire-and-forget, same convention as recordEventVisit — notifyEventWebhook already swallows
  // its own errors, so a slow/misconfigured receiver never delays or breaks the public response.
  void notifyEventWebhook(event, "registration.created", {
    registrationId: result.registration.id,
    status: result.registration.status,
    attendees: result.attendees.map((a) => ({ id: a.id, fullName: a.fullName, email: a.email })),
  });

  // design.md "Emails sent AFTER commit, never inside the lock" — dispatched here, outside
  // registerForEvent's transaction. spec.md "Confirmation Email Content" is sent only on
  // `confirmed` status; a waitlisted registration gets its email later, on promotion (PR3's
  // cancelRegistrationByToken / a future admin cancel path), not here.
  if (result.registration.status === "confirmed") {
    await Promise.all(
      result.attendees.map(async (attendee) => {
        const qrPng = await exportQrPng(attendee.passToken, {});
        await sendConfirmationEmail({
          organizationId: attendee.organizationId,
          attendeeId: attendee.id,
          to: attendee.email,
          attendeeName: attendee.fullName,
          eventName: event.name,
          backupCode: attendee.backupCode,
          qrPngBase64: qrPng.toString("base64"),
        });
      }),
    );
  }

  return { success: true, status: result.registration.status === "waitlisted" ? "waitlisted" : "confirmed" };
}
