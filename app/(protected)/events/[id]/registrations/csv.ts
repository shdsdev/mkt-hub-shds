import type { RegistrationWithAttendees } from "@/modules/events";

const BASE_HEADERS = ["fecha", "estado", "estado_revision", "contacto_principal", "correo_principal", "acompanantes", "utm_source", "pase", "solicita_mas_acompanantes", "marcas", "intereses", "privacidad_aceptada", "terminos_aceptados", "marketing_aceptado", "actividad_principal", "actividad_acompanante"];

const BRAND_LABELS: Record<string, string> = { shades: "Shades", bmighty: "BMighty", drapery: "Drapery" };
const INTEREST_LABELS: Record<string, string> = {
  "battery-motors": "Motores de baterías",
  "wifi-automation": "Motores WiFi y automatización",
  curtains: "Cortinería",
  "manual-and-motorized-rods": "Cortineros manuales y motorizados",
};
const OCCUPATION_LABELS: Record<string, string> = {
  distributor: "Distribuidor",
  manufacturer: "Fabricante",
  architect: "Arquitecto",
  decorator: "Decorador",
  "installer-technician": "Instalador o técnico",
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
  const customColumns = Array.from(
    new Map(
      registrations.flatMap((registration) => Object.entries(registration.customFormAnswers).map(([id, answer]) => [id, answer.label] as const)),
    ),
  ).sort(([, left], [, right]) => left.localeCompare(right, "es"));
  const rows = registrations.map((registration) => {
    const [primary, ...companions] = registration.attendees;
    const passStatus = primary?.checkedInAt ? "registrado" : "pendiente";
    const fields = [
      registration.createdAt.toISOString(),
      registration.status,
      registration.reviewStatus,
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
      OCCUPATION_LABELS[primary?.occupation ?? ""] ?? primary?.occupation ?? "",
      companions.map((companion) => OCCUPATION_LABELS[companion.occupation ?? ""] ?? companion.occupation ?? "").join("; "),
      ...customColumns.map(([id]) => formatCustomAnswer(registration.customFormAnswers[id]?.value)),
    ];
    return fields.map(escapeCsvField).join(",");
  });

  const header = [...BASE_HEADERS, ...customColumns.map(([, label]) => label)];
  return [header.map(escapeCsvField).join(","), ...rows].map((line) => `${line}\r\n`).join("");
}

function formatCustomAnswer(value: string | number | boolean | string[] | null | undefined): string {
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "boolean") return value ? "sí" : "no";
  return value === null || value === undefined ? "" : String(value);
}
