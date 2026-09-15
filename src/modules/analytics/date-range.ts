export type AnalyticsDateRange = { from: string; to: string };

export function utcDayBounds({ from, to }: AnalyticsDateRange): { from: Date; to: Date } {
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  };
}

// The immediately preceding period of equal length in days — the one, unambiguous definition of
// "período anterior" the org-wide Analytics dashboard uses everywhere it needs one. E.g. range
// 2026-09-01..2026-09-07 (7 days) → previous is 2026-08-25..2026-08-31 (also 7 days, ending the
// day before `from`).
export function previousPeriod({ from, to }: AnalyticsDateRange): AnalyticsDateRange {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const spanMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

// Inclusive day count between two "YYYY-MM-DD" strings — e.g. "2026-09-01".."2026-09-07" is 7.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}
