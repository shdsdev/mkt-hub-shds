import type { HeatmapCell } from "./heatmap";

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

export function ActivityHeatmap({ weeks, total }: { weeks: HeatmapCell[][]; total: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">Actividad</p>
        <p className="text-xs text-muted-foreground">{total} escaneos en las últimas 20 semanas</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, weekIndex) => {
          const showLabel =
            weekIndex === 0 || monthLabel(week[0].date) !== monthLabel(weeks[weekIndex - 1][0].date);
          return (
            <div key={week[0].date} className="flex flex-col gap-1">
              <p className="h-3 text-[10px] text-muted-foreground capitalize">
                {showLabel ? monthLabel(week[0].date) : ""}
              </p>
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} escaneo${cell.count === 1 ? "" : "s"}`}
                  className={`h-3 w-3 rounded-sm ${LEVEL_CLASS[cell.level]}`}
                />
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Pasá el mouse sobre un cuadro para ver el detalle</p>
    </div>
  );
}
