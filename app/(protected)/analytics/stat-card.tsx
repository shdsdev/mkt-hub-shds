"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

// Reusable "Mejor día"/"Mejor ubicación" card — same shell + trend-indicator style already used
// for the "+1.9% vs mitad anterior" stat in src/components/analytics/event-analytics-panel.tsx.
// `dateLabel` (best-day's formatted date) and `flag` (best-location's country flag) are optional
// since only one card uses each. `previous`, when given, is spliced into the trend text so the
// comparison shows the actual prior value, not just the percent — matches the Bitly reference the
// user compared against ("+21.2% vs 33 del período anterior").
export function StatCard({
  label,
  value,
  dateLabel,
  flag,
  percentChange,
  previous,
  comparisonLabel,
}: {
  label: string;
  value: string | null;
  dateLabel?: string;
  flag?: string;
  percentChange: number | null;
  previous?: number;
  comparisonLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      {value === null ? (
        <p className="mt-1 text-sm text-muted-foreground">Sin datos en este rango.</p>
      ) : (
        <>
          {dateLabel && <p className="mt-1 text-sm font-medium">{dateLabel}</p>}
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-accent">
              {flag && (
                <span aria-hidden className="mr-1">
                  {flag}
                </span>
              )}
              {value}
            </span>
            {percentChange !== null && (
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  percentChange >= 0 ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {percentChange >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {Math.abs(percentChange).toFixed(1)}%
                {previous !== undefined ? ` vs ${previous.toLocaleString()} ${comparisonLabel}` : ` ${comparisonLabel}`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
