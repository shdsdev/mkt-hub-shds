"use client";

import { useEffect, useState } from "react";
import { Tooltip } from "@/components/tooltip";
import type { HeatmapCell } from "./heatmap";
import { buildHeatmapWeeks } from "./heatmap";

const HEATMAP_WEEKS = 20;

const LEVEL_CLASS: Record<HeatmapCell["level"], string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary",
};

function monthLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("es", {
    month: "short",
    timeZone: "UTC",
  });
}

export function ActivityHeatmap({
  linkId,
  from,
  to,
  weeks: initialWeeks,
  total: initialTotal,
}: {
  linkId: string;
  from: string;
  to: string;
  weeks: HeatmapCell[][];
  total: number;
}) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [total, setTotal] = useState(initialTotal);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ granularity: "day", from, to });

    async function loadHeatmap() {
      const response = await fetch(`/analytics/${linkId}/data?${params}`, { cache: "no-store" });
      if (!response.ok || cancelled) return;

      const data: { buckets?: Array<{ bucket: string; count: number }> } = await response.json();
      if (cancelled) return;

      const buckets = data.buckets ?? [];
      const counts = new Map(buckets.map((row) => [row.bucket, row.count]));
      setWeeks(buildHeatmapWeeks(counts, HEATMAP_WEEKS, new Date(`${to}T00:00:00Z`)));
      setTotal(buckets.reduce((sum, row) => sum + row.count, 0));
    }

    void loadHeatmap();
    const refreshTimer = window.setInterval(() => void loadHeatmap(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [from, linkId, to]);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Actividad
        </p>
        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
          Últimas 20 semanas
        </span>
      </div>
      <p className="mb-5 font-heading text-3xl font-bold">
        {total} <span className="text-sm font-normal text-muted-foreground">escaneos</span>
      </p>

      <div className="flex justify-center gap-1.5 overflow-x-auto pb-1">
        {weeks.map((week, weekIndex) => {
          const showLabel =
            weekIndex === 0 || monthLabel(week[0].date) !== monthLabel(weeks[weekIndex - 1][0].date);
          return (
            <div key={week[0].date} className="flex flex-col gap-1.5">
              <p className="h-4 text-[11px] text-muted-foreground capitalize">
                {showLabel ? monthLabel(week[0].date) : ""}
              </p>
              {week.map((cell) => (
                <Tooltip
                  key={cell.date}
                  label={`${cell.date}: ${cell.count} escaneo${cell.count === 1 ? "" : "s"}`}
                >
                  <div className={`h-4 w-4 rounded-[4px] ${LEVEL_CLASS[cell.level]}`} />
                </Tooltip>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Pasá el mouse sobre un cuadro para ver el detalle
      </p>
    </div>
  );
}
