"use client";

type BreakdownRow = { label: string; count: number };

// Same list styling as EventAnalyticsPanel's BreakdownList — "Directo" (no Referer header, the
// common case for QR scans opened from a camera app) renders muted/italic to visually distinguish
// "no referrer" from a real domain.
export function ReferrerList({ rows }: { rows: BreakdownRow[] | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">Por referente</p>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between">
              <span className={row.label === "Directo" ? "italic text-muted-foreground/70" : "text-muted-foreground"}>
                {row.label}
              </span>
              <span className="font-medium">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
