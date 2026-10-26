"use server";

import { z } from "zod";
import { env } from "@/lib/env";
import { getMexicanStateLabel, MEXICAN_STATES } from "@/lib/events/mexican-states";
import { getOccupationPresentation } from "@/lib/events/occupation-presentation";
import {
  getPublishedEventBySlugPublic,
  listEventReceptionistIds,
  registerForEvent,
  notifyEventWebhook,
  OCCUPATION_OPTIONS,
  resolveRegistrationFormConfig,
  type AttendeeInput,
} from "@/modules/events";
import {
  buildRegistrationTelegramMessage,
  createInternalNotifications,
  resolveTelegramChatId,
  resolveTelegramMessageTemplate,
  sendConfirmationEmail,
  sendTelegramMessage,
} from "@/modules/notifications";
import { listManagedUsers } from "@/modules/users";
import { exportQrPng } from "@/modules/qr";
import { resolveEventEmailContent } from "@/lib/events/event-email-content";
import { getCompanionContactErrors } from "@/lib/events/companion-contact-validation";
import { parseRegistrationFormAnswers } from "../registration-form-answers";

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
const PUBLIC_FORM_KEYS = [
  "slug", "website", "fullName", "email", "phone", "company", "jobTitle", "occupation", "state",
  "companionFullName", "companionEmail", "companionPhone", "companionCompany", "companionCompanyMode",
  "companionJobTitle", "companionOccupation", "companionState", "requestMoreCompanions", "privacyAccepted", "termsAccepted",
  "marketingAccepted", "clientBrands", "interests", "utmSource", "utmMedium", "utmCampaign", "utmTerm",
  "utmContent", "utmId",
] as const;

const attendeeSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  company: z.string().trim().max(255).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(255).optional().or(z.literal("")),
  occupation: z.enum(OCCUPATION_OPTIONS),
  state: z.string().trim().max(100).optional().or(z.literal("")),
});

const MEXICAN_STATE_VALUES = new Set<string>(MEXICAN_STATES.map((state) => state.value));

export type RegisterFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  status?: "pending_review" | "confirmed" | "waitlisted" | "rejected";
};

function normalizeAttendee(parsed: z.infer<typeof attendeeSchema>): AttendeeInput {
  return {
    fullName: parsed.fullName,
    email: parsed.email,
    phone: parsed.phone || undefined,
    company: parsed.company || undefined,
    jobTitle: parsed.jobTitle || undefined,
    state: parsed.state || undefined,
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
  fields: { phone: { visible: boolean; required: boolean }; company: { visible: boolean; required: boolean }; jobTitle: { visible: boolean; required: boolean }; state: { visible: boolean; required: boolean } },
): string | undefined {
  const requiredFields = [
    ["phone", attendee.phone, fields.phone, "El teléfono"],
    ["company", attendee.company, fields.company, "La empresa"],
    ["jobTitle", attendee.jobTitle, fields.jobTitle, "El puesto"],
    ["state", attendee.state, fields.state, "El estado"],
  ] as const;

  for (const [, value, field, label] of requiredFields) {
    if (field.required && !value?.trim()) return `${label} es obligatorio.`;
  }
  return undefined;
}

function normalizeConfiguredAttendee(
  parsed: z.infer<typeof attendeeSchema>,
  fields: { phone: { visible: boolean; required: boolean }; company: { visible: boolean; required: boolean }; jobTitle: { visible: boolean; required: boolean }; state: { visible: boolean; required: boolean } },
): AttendeeInput {
  const normalized = normalizeAttendee(parsed);
  return {
    ...normalized,
    phone: fields.phone.visible ? normalized.phone : undefined,
    company: fields.company.visible ? normalized.company : undefined,
    jobTitle: fields.jobTitle.visible ? normalized.jobTitle : undefined,
    state: fields.state.visible ? normalized.state : undefined,
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
  const states = formData.getAll("companionState").map(String);

  const rowCount = Math.max(fullNames.length, emails.length, phones.length, companies.length, jobTitles.length, occupations.length, states.length);
  return Array.from({ length: rowCount }, (_, index) => ({
      fullName: fullNames[index] ?? "",
      email: emails[index] ?? "",
      phone: phones[index] ?? "",
      company: companies[index] ?? "",
       jobTitle: jobTitles[index] ?? "",
       occupation: occupations[index] ?? "",
       state: states[index] ?? "",
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
  const customAnswers = parseRegistrationFormAnswers(formConfig.customFields, formData, PUBLIC_FORM_KEYS);
  if (!customAnswers.ok) return { error: customAnswers.error, fieldErrors: customAnswers.fieldErrors };
  const occupation = formData.get("occupation");
  if (typeof occupation !== "string" || !OCCUPATION_OPTIONS.includes(occupation as never)) {
    return { error: INVALID_OCCUPATION_ERROR, fieldErrors: { occupation: INVALID_OCCUPATION_ERROR } };
  }

  const primaryCompany = z.string().trim().max(255).optional().safeParse(formData.get("company") || undefined);
  if (!primaryCompany.success) return { error: "Revisa los datos de la empresa." };
  const primaryParsed = attendeeSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? undefined,
    company: primaryCompany.data,
    jobTitle: formData.get("jobTitle") ?? undefined,
    occupation: formData.get("occupation") ?? "",
    state: formData.get("state") ?? undefined,
  });
  if (!primaryParsed.success) {
    return {
      error: INVALID_FORM_ERROR,
      fieldErrors: Object.fromEntries(primaryParsed.error.issues.map((issue) => [String(issue.path[0] ?? "fullName"), "Revisá este campo."])),
    };
  }
  if (primaryParsed.data.state && !MEXICAN_STATE_VALUES.has(primaryParsed.data.state)) {
    return { error: INVALID_FORM_ERROR, fieldErrors: { state: "Seleccioná un estado válido." } };
  }
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
  let companionsData = companionsParsed.data;
  let resolvedCompanionCompany: string | undefined;
  if (companionsData[0] && formConfig.fields.company.visible) {
    const companionCompanyMode = z.enum(["same", "other"]).safeParse(formData.get("companionCompanyMode"));
    if (!companionCompanyMode.success) return { error: "Revisa la empresa del acompañante." };
    const rawCompanionCompany = z.string().trim().max(255).safeParse(formData.get("companionCompany") ?? "");
    if (!rawCompanionCompany.success) return { error: "Revisa la empresa del acompañante." };
    resolvedCompanionCompany = companionCompanyMode.data === "same"
      ? primaryCompany.data
      : rawCompanionCompany.data;
    if (!resolvedCompanionCompany) return { error: "Revisa la empresa del acompañante." };

    companionsData = [{ ...companionsData[0], company: resolvedCompanionCompany }, ...companionsData.slice(1)];
  }
  const companionFieldError = companionsData[0] && validateConfiguredFields(companionsData[0], formConfig.fields);
  if (companionFieldError) return { error: companionFieldError.replace(/^El |^La /, "El acompañante: ") };

  const contactErrors = getCompanionContactErrors({
    primaryEmail: primaryParsed.data.email,
    companionEmail: companionsData[0]?.email ?? "",
    primaryPhone: primaryParsed.data.phone ?? "",
    companionPhone: companionsData[0]?.phone ?? "",
  });
  if (Object.keys(contactErrors).length > 0) {
    return { error: INVALID_COMPANION_ERROR, fieldErrors: contactErrors };
  }

  if (!isAccepted(formData, "privacyAccepted") || !isAccepted(formData, "termsAccepted")) {
    return {
      error: INVALID_CONSENT_ERROR,
      fieldErrors: {
        ...(!isAccepted(formData, "privacyAccepted") ? { privacyAccepted: "Aceptá la política de privacidad." } : {}),
        ...(!isAccepted(formData, "termsAccepted") ? { termsAccepted: "Aceptá los términos y condiciones." } : {}),
      },
    };
  }

  const clientBrands = readSelectedOptions(formData, "clientBrands");
  if (clientBrands.includes("none") && clientBrands.length > 1) return { error: INVALID_BRAND_COMBINATION_ERROR };
  if (!formConfig.clientBrands.enabled && clientBrands.length > 0) return { error: INVALID_BRANDS_ERROR };
  if (clientBrands.some((option) => option !== "none" && !formConfig.clientBrands.options.some((allowed) => allowed === option))) {
    return { error: INVALID_BRANDS_ERROR };
  }

  const interests = readSelectedOptions(formData, "interests");
  if (!formConfig.interests.enabled && interests.length > 0) return { error: INVALID_INTERESTS_ERROR };
  if (interests.some((option) => !formConfig.interests.options.some((allowed) => allowed === option))) {
    return { error: INVALID_INTERESTS_ERROR };
  }

  const now = new Date();
  const marketingAccepted = isAccepted(formData, "marketingAccepted");

  const companions = companionsData.map((companion, index) => ({
    ...normalizeConfiguredAttendee(companion, formConfig.fields),
    ...(index === 0 && resolvedCompanionCompany ? { company: resolvedCompanionCompany } : {}),
  }));

  let result;
  try {
    result = await registerForEvent({
      eventId: event.id,
      source: "public",
      primary: normalizeConfiguredAttendee(primaryParsed.data, formConfig.fields),
      companions,
      clientBrands,
      interests,
      requestedMoreCompanions: isAccepted(formData, "requestMoreCompanions"),
      consents: {
        privacyAcceptedAt: now,
        termsAcceptedAt: now,
        ...(formConfig.consent.marketing.enabled && marketingAccepted ? { marketingAcceptedAt: now } : {}),
      },
      formVersion: formConfig.customFieldsVersion,
      customFormAnswers: customAnswers.answers,
      utm: readUtm(formData),
    });
  } catch (error) {
    const { captureOperationFailure } = await import("@/modules/monitoring");
    captureOperationFailure({ operation: "event_registration", module: "events", error });
    return { error: EVENT_UNAVAILABLE_ERROR };
  }

  if (!result.ok) {
    return { error: result.reason === "duplicate_email" ? DUPLICATE_EMAIL_ERROR : EVENT_UNAVAILABLE_ERROR };
  }

  const responsibleIds = await listEventReceptionistIds(event.id, event.organizationId);
  const adminIds = (await listManagedUsers(event.organizationId))
    .filter((user) => user.role === "ADMIN" && user.status === "active")
    .map((user) => user.id);
  const recipientIds = [...new Set([...responsibleIds, ...adminIds])];
  const reviewUrl = `${env.NEXT_PUBLIC_APP_ORIGIN}/events/${event.id}/registrations?registrationId=${result.registration.id}`;
  const telegramChatId = await resolveTelegramChatId({
    organizationId: event.organizationId,
    eventChatId: event.telegramChatId,
  });
  const telegramTemplate = await resolveTelegramMessageTemplate({
    organizationId: event.organizationId,
    eventTemplate: event.telegramMessageTemplate,
  });
  void Promise.resolve(createInternalNotifications({
    organizationId: event.organizationId,
    recipientUserIds: recipientIds,
    subjectId: result.registration.id,
    type: "registration_submitted",
    title: "Nuevo registro pendiente",
    body: `Hay una nueva solicitud para ${event.name}. Revisá el candidato para decidir si puede asistir.`,
    href: reviewUrl,
    dedupeKey: `registration-submitted:${result.registration.id}`,
  })).catch(() => undefined);
  if (telegramChatId) {
    const message = buildRegistrationTelegramMessage({
      eventName: event.name,
      reviewUrl,
      template: telegramTemplate,
      values: {
        nombre: primaryParsed.data.fullName,
        email: primaryParsed.data.email,
        telefono: primaryParsed.data.phone ?? "",
        empresa: primaryParsed.data.company ?? "",
        puesto: primaryParsed.data.jobTitle ?? "",
        ocupacion: getOccupationPresentation(primaryParsed.data.occupation).label,
        estado: getMexicanStateLabel(primaryParsed.data.state),
        fecha_evento: new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(event.startsAt),
      },
    });
    await Promise.resolve()
      .then(() => sendTelegramMessage({ token: env.TELEGRAM_BOT_TOKEN, chatId: telegramChatId, text: message.text, replyMarkup: message.replyMarkup }))
      .catch(() => undefined);
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
    const manageUrl = `${env.NEXT_PUBLIC_APP_ORIGIN}/events/cancel/${result.registration.cancelToken}`;
    await Promise.all(
      result.attendees.map(async (attendee) => {
        const qrPng = await exportQrPng(attendee.backupCode, {});
        await sendConfirmationEmail({
          organizationId: attendee.organizationId,
          attendeeId: attendee.id,
          to: attendee.email,
          attendeeName: attendee.fullName,
          eventName: event.name,
          backupCode: attendee.backupCode,
          qrPngBase64: qrPng.toString("base64"),
          eventStartsAt: event.startsAt,
          eventEndsAt: event.endsAt,
            eventLocation: event.location,
            eventLocationUrl: event.locationUrl,
           manageUrl,
           emailContent: resolveEventEmailContent(event.emailContent),
           agenda: event.agenda,
         });
      }),
    );
  }

  return {
    success: true,
    status: result.registration.status === "pending_review"
      ? "pending_review"
      : result.registration.status === "waitlisted"
        ? "waitlisted"
        : "confirmed",
  };
}
