import type { RegistrationWithAttendees } from "@/modules/events";

const BRAND_LABELS: Record<string, string> = {
  shades: "Shades",
  bmighty: "BMighty",
  drapery: "Drapery",
};

const INTEREST_LABELS: Record<string, string> = {
  "battery-motors": "Motores de baterías",
  "wifi-automation": "Motores WiFi y automatización",
  curtains: "Cortinería",
  "manual-and-motorized-rods": "Cortineros manuales y motorizados",
};

export function getPrimaryAttendee(registration: RegistrationWithAttendees) {
  return registration.attendees[0];
}

export function getRegistrationTableValues(registration: RegistrationWithAttendees) {
  const [primary, ...companions] = registration.attendees;

  return {
    companionCount: companions.length,
    brands: registration.clientBrands.map((value) => BRAND_LABELS[value] ?? value).join(", ") || "—",
    interests: registration.interests.map((value) => INTEREST_LABELS[value] ?? value).join(", ") || "—",
    pass: primary?.checkedInAt ? "Registrado" : "Pendiente",
    followUp: registration.requestedMoreCompanions,
    source: registration.utmSource ?? (registration.source === "admin_added" ? "Admin" : "Directo"),
  };
}
