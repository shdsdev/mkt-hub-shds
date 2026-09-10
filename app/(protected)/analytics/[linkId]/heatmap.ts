export type HeatmapCell = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function levelFor(count: number, max: number): HeatmapCell["level"] {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as HeatmapCell["level"];
}

// Chronological 7-day chunks ending "today" — not calendar-week-aligned (simpler, no day-of-week
// edge cases, still reads as a GitHub-style activity grid for this internal tool's purposes).
export function buildHeatmapWeeks(
  counts: Map<string, number>,
  weeksCount: number,
  today: Date,
): HeatmapCell[][] {
  const totalDays = weeksCount * 7;
  const days: { date: string; count: number }[] = [];

  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const key = toDateKey(date);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }

  const max = Math.max(0, ...days.map((day) => day.count));
  const cells = days.map((day) => ({ ...day, level: levelFor(day.count, max) }));

  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
