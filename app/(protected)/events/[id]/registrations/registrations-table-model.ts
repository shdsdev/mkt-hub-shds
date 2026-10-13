import type { RegistrationWithAttendees } from "@/modules/events";

const CLIENT_BRANDS = new Set(["shades", "bmighty", "drapery"]);

export function getPrimaryAttendee(registration: RegistrationWithAttendees) {
  return registration.attendees[0];
}

export function getRegistrationTableValues(registration: RegistrationWithAttendees) {
  const [primary, ...companions] = registration.attendees;

  return {
    companionCount: companions.length,
    isClient: registration.clientBrands.some((value) => CLIENT_BRANDS.has(value)),
    status: primary?.checkedInAt ? "Check-in" : "Pendiente",
    followUp: registration.requestedMoreCompanions,
    source: registration.utmSource ?? (registration.source === "admin_added" ? "Admin" : "Directo"),
  };
}
