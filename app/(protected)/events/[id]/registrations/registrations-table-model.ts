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

export function getRegistrationSourceBadgeClass(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (normalized.includes("whatsapp")) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  if (normalized.includes("instagram")) return "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-200";
  if (normalized.includes("facebook") || normalized.includes("meta")) return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200";
  if (normalized.includes("google")) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  if (normalized.includes("email") || normalized.includes("mail")) return "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200";
  if (normalized.includes("admin")) return "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200";
  return "border-border bg-muted text-foreground";
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
