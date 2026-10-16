const REGISTRATION_TIME_ZONE = "America/Mexico_City";

const registrationDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: REGISTRATION_TIME_ZONE,
});

export function formatRegistrationDate(value: Date | string): string {
  return registrationDateFormatter.format(typeof value === "string" ? new Date(value) : value);
}
