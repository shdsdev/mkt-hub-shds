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

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weeks.map((week, weekIndex) => {
          const showLabel =
            weekIndex === 0 || monthLabel(week[0].date) !== monthLabel(weeks[weekIndex - 1][0].date);
          return (
            <div key={week[0].date} className="flex flex-col gap-1.5">
              <p className="h-4 text-[11px] text-muted-foreground capitalize">
                {showLabel ? monthLabel(week[0].date) : ""}
              </p>
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} escaneo${cell.count === 1 ? "" : "s"}`}
                  className={`h-4 w-4 rounded-[4px] ${LEVEL_CLASS[cell.level]}`}
                />
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
