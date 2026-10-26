function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const EVENT_TIME_ZONE = "America/Mexico_City";

export function splitDateTimeLocal(date: Date | null): { date: string; time: string } {
  if (!date) return { date: "", time: "" };
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function combineDateTimeLocal(date: string, time: string): string {
  if (!date || !time) throw new Error("La fecha y hora del evento son obligatorias.");
  return `${date}T${time}`;
}

export function parseDateTimeLocal(value: string): Date {
  const candidate = new Date(`${value}:00Z`);
  if (Number.isNaN(candidate.getTime())) throw new Error("La fecha y hora del evento no son válidas.");

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(candidate);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: partValue }) => [type, Number(partValue)]));
  const localAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return new Date(candidate.getTime() - (localAsUtc - candidate.getTime()));
}

export function combineOptionalDateTimeLocal(date: string, time: string): string {
  if (!date && !time) return "";
  if (!date || !time) throw new Error("La fecha y hora de finalización deben completarse juntas.");
  return `${date}T${time}`;
}

export function getOptionalDateTimeError(date: string, time: string): string | null {
  return Boolean(date) !== Boolean(time) ? "La fecha y hora de finalización deben completarse juntas." : null;
}
