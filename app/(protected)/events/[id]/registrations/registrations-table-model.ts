import { MEXICAN_STATES } from "@/lib/events/mexican-states";
import type { RegistrationWithAttendees } from "@/modules/events";

const CLIENT_BRANDS = new Set(["shades", "bmighty", "drapery"]);
const STATE_LABELS = new Map<string, string>(MEXICAN_STATES.map((state) => [state.value, state.label]));

export function getPrimaryAttendee(registration: RegistrationWithAttendees) {
  return registration.attendees[0];
}

export function isMetaAdsRegistration(registration: RegistrationWithAttendees): boolean {
  const source = registration.utmSource?.trim().toLowerCase();
  const medium = registration.utmMedium?.trim().toLowerCase();
  const isMetaSource = source === "facebook" || source === "instagram" || source === "meta";
  return isMetaSource && Boolean(medium && /paid|ads|cpc|ppc/.test(medium));
}

export function getRegistrationSourceLabel(registration: RegistrationWithAttendees): string {
  if (isMetaAdsRegistration(registration)) return "Meta Ads";
  if (registration.utmSource?.trim()) return registration.utmSource.trim();
  if (registration.source === "admin_added") return "Admin";
  return "Sin atribución";
}

export function getRegistrationTableValues(registration: RegistrationWithAttendees) {
  const [primary, ...companions] = registration.attendees;
  const primaryCheckedIn = Boolean(primary?.checkedInAt);
  const everyoneCheckedIn = registration.attendees.length > 0 && registration.attendees.every((attendee) => Boolean(attendee.checkedInAt));

  return {
    companionCount: companions.length,
    isClient: registration.clientBrands.some((value) => CLIENT_BRANDS.has(value)),
    status: everyoneCheckedIn ? "Check-in" : primaryCheckedIn ? "Confirmado" : "Pendiente",
    followUp: registration.requestedMoreCompanions,
    source: registration.utmSource ?? (registration.source === "admin_added" ? "Admin" : "Directo"),
    state: STATE_LABELS.get(primary?.state ?? "") ?? "Sin indicar",
  };
}
