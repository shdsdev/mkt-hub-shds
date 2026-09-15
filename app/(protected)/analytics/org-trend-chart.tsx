"use client";

import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BinaryLoader } from "@/components/binary-loader";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type Bucket = { bucket: string; count: number };

// Same visual language as EventAnalyticsPanel's LineChart (gradient fill, CartesianGrid, custom
// single-row Tooltip content, dashed accent cursor) — a new component, not a shared one, since
// EventAnalyticsPanel's linkId/dataUrl/CSV-export contract is specifically per-link shaped. No
// SVG glow filter here (EventAnalyticsPanel's chart has one on its Line) — dropped as a minor
// simplification, not a bug fix: the geometry was always correct (verified via getBBox() with and
// without the filter attribute, same non-empty result both times), the gradient area fill alone
// already gives the line enough visual weight.
// Unlike EventAnalyticsPanel's one Line + average ReferenceLine, this overlays two series: the
// current period (solid) and the previous period (dashed, muted) — both the same length/
// granularity by construction, merged by array index so Recharts reads one dataset.
export function OrgTrendChart({
  trend,
  previousTrend,
  pluralLabel,
  loading,
}: {
  trend: Bucket[] | undefined;
  previousTrend: Bucket[] | undefined;
  pluralLabel: string;
  loading: boolean;
}) {
  const data =
    trend?.map((row, index) => ({
      ...row,
      previousCount: previousTrend?.[index]?.count ?? 0,
    })) ?? [];

  return (
    <div className="h-64 rounded-lg border border-border bg-card p-4">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <BinaryLoader />
        </div>
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <defs>
              <linearGradient id="orgCountGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
              tickFormatter={(value) => {
                try {
                  return format(parseISO(value), "dd MMM", { locale: es });
                } catch {
                  return value;
                }
              }}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
            <Tooltip
              cursor={{ stroke: "var(--accent)", strokeDasharray: "4 4", strokeOpacity: 0.35 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                let dateLabel = label as string;
                try {
                  dateLabel = format(parseISO(label as string), "dd MMM yyyy", { locale: es });
                } catch {
                  // keep the raw label
                }
                const current = payload.find((entry) => entry.dataKey === "count");
                const previous = payload.find((entry) => entry.dataKey === "previousCount");
                return (
                  <div
                    className="rounded-md px-3 py-2 text-sm"
                    style={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
                  >
                    <p className="text-muted-foreground">{dateLabel}</p>
                    <p style={{ color: "var(--accent)" }}>
                      {pluralLabel}: {current?.value}
                    </p>
                    <p className="text-muted-foreground">Período anterior: {previous?.value}</p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="count" stroke="none" fill="url(#orgCountGradient)" />
            <Line
              type="monotone"
              dataKey="previousCount"
              name="Período anterior"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, fill: "var(--muted-foreground)" }}
            />
            <Line
              type="monotone"
              dataKey="count"
              name={pluralLabel}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Sin datos en este rango.
        </div>
      )}
    </div>
  );
}
