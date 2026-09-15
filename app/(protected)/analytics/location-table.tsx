"use client";

import { useState } from "react";
import type { AnalyticsSurface } from "@/modules/analytics";

type BreakdownRow = { label: string; count: number };

// ISO-2 country code -> regional-indicator flag emoji. A well-known zero-dependency trick: each
// letter maps to its regional-indicator symbol (U+1F1E6 = 127462, offset from 'A' = 65). Exported
// so StatCard's "Mejor ubicación" card reuses the same helper instead of duplicating it.
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

// Country + count + % of total. Rows are clickable: expanding one lazily fetches
// /analytics/data/region for that country (cached locally after the first fetch — collapsing and
// re-expanding the same row never re-fetches) and renders its region breakdown indented below.
// Only one row is expanded at a time, which keeps the interaction and the state simple. Sorted
// descending, no server-side pagination — the expected row count is every distinct country seen
// in range, not every event.
export function LocationTable({
  rows,
  surface,
  from,
  to,
}: {
  rows: BreakdownRow[] | undefined;
  surface: AnalyticsSurface;
  from: string;
  to: string;
}) {
  const total = rows?.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [regionCache, setRegionCache] = useState<Record<string, BreakdownRow[]>>({});

  // A cached region breakdown is only valid for the surface/range it was fetched under — switching
  // either (e.g. Enlaces -> Códigos QR) must drop stale entries, not keep showing the previous
  // surface's numbers under the new one. Reset during render (not in an effect) when the key
  // changes, same pattern as ColorField's external-value sync.
  const [lastKey, setLastKey] = useState(`${surface}|${from}|${to}`);
  const key = `${surface}|${from}|${to}`;
  if (key !== lastKey) {
    setLastKey(key);
    setExpanded(null);
    setRegionCache({});
  }

  async function toggleRow(country: string) {
    if (expanded === country) {
      setExpanded(null);
      return;
    }
    setExpanded(country);
    if (regionCache[country]) return;

    const params = new URLSearchParams({ surface, country, from, to });
    const response = await fetch(`/analytics/data/region?${params}`);
    if (!response.ok) return;
    const json: { regions: BreakdownRow[] } = await response.json();
    setRegionCache((prev) => ({ ...prev, [country]: json.regions }));
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">Por ubicación</p>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((row) => {
            const isOpen = expanded === row.label;
            const regions = regionCache[row.label];
            return (
              <li key={row.label}>
                <button
                  type="button"
                  onClick={() => toggleRow(row.label)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 rounded-sm py-0.5 text-left hover:text-foreground"
                >
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span aria-hidden>{countryFlag(row.label)}</span>
                    {row.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {total > 0 ? ((row.count / total) * 100).toFixed(1) : "0.0"}%
                    </span>
                    <span className="font-medium">{row.count}</span>
                  </span>
                </button>
                {isOpen && (
                  <ul className="ml-4 mt-1 flex flex-col gap-1 border-l border-border pl-3 text-xs">
                    {regions === undefined ? (
                      <li className="text-muted-foreground">Cargando…</li>
                    ) : regions.length === 0 ? (
                      <li className="text-muted-foreground">Sin datos de región.</li>
                    ) : (
                      regions.map((region) => {
                        const countryTotal = regions.reduce((sum, r) => sum + r.count, 0);
                        return (
                          <li key={region.label} className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{region.label}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {countryTotal > 0 ? ((region.count / countryTotal) * 100).toFixed(1) : "0.0"}%
                              </span>
                              <span className="font-medium">{region.count}</span>
                            </span>
                          </li>
                        );
                      })
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
