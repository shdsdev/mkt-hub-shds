function pad(value: number): string {
  return String(value).padStart(2, "0");
}

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

export function combineOptionalDateTimeLocal(date: string, time: string): string {
  if (!date && !time) return "";
  if (!date || !time) throw new Error("La fecha y hora de finalización deben completarse juntas.");
  return `${date}T${time}`;
}

export function getOptionalDateTimeError(date: string, time: string): string | null {
  return Boolean(date) !== Boolean(time) ? "La fecha y hora de finalización deben completarse juntas." : null;
}
