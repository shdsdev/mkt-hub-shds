"use server";

import { z } from "zod";
import { getPublishedEventBySlugPublic, registerForEvent, type AttendeeInput } from "@/modules/events";
import { sendConfirmationEmail } from "@/modules/notifications";
import { exportQrPng } from "@/modules/qr";

const EVENT_UNAVAILABLE_ERROR = "Este evento ya no está disponible.";
const INVALID_FORM_ERROR = "Revisa tus datos de contacto.";
const INVALID_COMPANION_ERROR = "Revisa los datos de tus acompañantes.";
const DUPLICATE_EMAIL_ERROR = "Ya existe un registro activo con este correo para este evento.";

const attendeeSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  company: z.string().trim().max(255).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(255).optional().or(z.literal("")),
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

  return fullNames
    .map((fullName, index) => ({
      fullName,
      email: emails[index] ?? "",
      phone: phones[index] ?? "",
      company: companies[index] ?? "",
      jobTitle: jobTitles[index] ?? "",
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
  const slug = formData.get("slug");
  if (typeof slug !== "string" || !slug) return { error: EVENT_UNAVAILABLE_ERROR };

  const event = await getPublishedEventBySlugPublic(slug);
  if (!event) return { error: EVENT_UNAVAILABLE_ERROR };

  const primaryParsed = attendeeSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? undefined,
    company: formData.get("company") ?? undefined,
    jobTitle: formData.get("jobTitle") ?? undefined,
  });
  if (!primaryParsed.success) return { error: INVALID_FORM_ERROR };

  const companionsParsed = z.array(attendeeSchema).safeParse(readCompanions(formData));
  if (!companionsParsed.success) return { error: INVALID_COMPANION_ERROR };

  const result = await registerForEvent({
    eventId: event.id,
    source: "public",
    primary: normalizeAttendee(primaryParsed.data),
    companions: companionsParsed.data.map(normalizeAttendee),
    utm: readUtm(formData),
  });

  if (!result.ok) {
    return { error: result.reason === "duplicate_email" ? DUPLICATE_EMAIL_ERROR : EVENT_UNAVAILABLE_ERROR };
  }

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
