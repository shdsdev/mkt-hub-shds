import type { RegistrationWithAttendees } from "@/modules/events";

const HEADER = "fecha,estado,contacto_principal,correo_principal,acompanantes,utm_source,pase,solicita_mas_acompanantes,marcas,intereses,privacidad_aceptada,terminos_aceptados,marketing_aceptado";

const BRAND_LABELS: Record<string, string> = { shades: "Shades", bmighty: "BMighty", drapery: "Drapery" };
const INTEREST_LABELS: Record<string, string> = {
  "battery-motors": "Motores de baterías",
  "wifi-automation": "Motores WiFi y automatización",
  curtains: "Cortinería",
  "manual-and-motorized-rods": "Cortineros manuales y motorizados",
};

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// spec.md "Authorized Registration Export" — one row per registration (not per attendee): the
// primary attendee is always `attendees[0]` (registerForEvent inserts primary before companions,
// in order), and companions are concatenated so the export stays reviewable in a spreadsheet
// rather than fragmenting one booking across multiple rows.
export function buildRegistrationsCsv(registrations: RegistrationWithAttendees[]): string {
  const rows = registrations.map((registration) => {
    const [primary, ...companions] = registration.attendees;
    const passStatus = primary?.checkedInAt ? "registrado" : "pendiente";
    const fields = [
      registration.createdAt.toISOString(),
      registration.status,
      primary?.fullName ?? "",
      primary?.email ?? "",
      companions.map((companion) => companion.fullName).join("; "),
      registration.utmSource ?? "",
      passStatus,
      registration.requestedMoreCompanions ? "sí" : "no",
      registration.clientBrands.map((brand) => BRAND_LABELS[brand] ?? brand).join("; "),
      registration.interests.map((interest) => INTEREST_LABELS[interest] ?? interest).join("; "),
      registration.consents?.privacyAcceptedAt ?? "",
      registration.consents?.termsAcceptedAt ?? "",
      registration.consents?.marketingAcceptedAt ?? "",
    ];
    return fields.map(escapeCsvField).join(",");
  });

  return [HEADER, ...rows].map((line) => `${line}\r\n`).join("");
}
