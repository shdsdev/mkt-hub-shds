"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type BreakdownRow = { label: string; count: number };

// Theme-token colors cycling through the app's existing palette — no new literal hex values.
const SLICE_COLORS = [
  "var(--accent)",
  "var(--primary)",
  "var(--secondary)",
  "var(--muted-foreground)",
  "var(--destructive)",
];

export function DeviceDonut({ rows }: { rows: BreakdownRow[] | undefined }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">Por dispositivo</p>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="count" nameKey="label" innerRadius={40} outerRadius={70}>
                  {rows.map((row, index) => (
                    <Cell key={row.label} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-1 flex-col gap-1 text-sm">
            {rows.map((row, index) => (
              <li key={row.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                  />
                  {row.label}
                </span>
                <span className="font-medium">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
