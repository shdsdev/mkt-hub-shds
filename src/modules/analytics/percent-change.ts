// Shared by every "current vs previous period" comparison in the org-wide Analytics dashboard —
// `previous === 0` means there's nothing meaningful to compare against (would read as +∞% or an
// arbitrary +100%), so it reads as "no comparison available" instead of a misleading number.
export function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
