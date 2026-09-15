"use client";

import { useEffect, useState } from "react";
import { Area, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Download } from "lucide";
import { TrendingUp, TrendingDown, CircleHelp } from "lucide-react";
import { BinaryLoader } from "@/components/binary-loader";
import { Tooltip as InfoTooltip } from "@/components/tooltip";
import { HoverMorphIcon } from "@/components/hover-morph-icon";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRange } from "react-day-picker";
import { format, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type AnalyticsGranularity = "day" | "week" | "month";
type BreakdownRow = { label: string; count: number };

type EventAnalyticsPanelProps = {
  linkId: string;
  heading: string;
  surface: "qr" | "links";
  dataUrl: string;
  csvUrl: string;
  emptyMessage: string;
  showBreakdowns: boolean;
};

type PanelData = {
  buckets: Array<{ bucket: string; count: number }>;
  devices?: BreakdownRow[];
  countries?: BreakdownRow[];
  cities?: BreakdownRow[];
  totals?: { total: number; unique: number };
};

function defaultRange(): DateRange {
  const to = new Date();
  return { from: subDays(to, 29), to };
}

function dateParams(range: DateRange, granularity?: AnalyticsGranularity): URLSearchParams {
  if (!range.from || !range.to) return new URLSearchParams();
  return new URLSearchParams({
    ...(granularity ? { granularity } : {}),
    from: format(range.from, "yyyy-MM-dd"),
    to: format(range.to, "yyyy-MM-dd"),
  });
}

function computeStats(buckets: Array<{ count: number }>) {
  let minIndex = 0;
  let maxIndex = 0;
  let sum = 0;
  for (let i = 0; i < buckets.length; i++) {
    const count = buckets[i].count;
    sum += count;
    if (count < buckets[minIndex].count) minIndex = i;
    if (count > buckets[maxIndex].count) maxIndex = i;
  }
  return { minIndex, maxIndex, average: buckets.length ? sum / buckets.length : 0 };
}

function computeTrend(buckets: Array<{ count: number }>) {
  if (buckets.length < 4) return null;
  const half = Math.ceil(buckets.length / 2);
  const first = buckets.slice(0, half).reduce((s, b) => s + b.count, 0);
  const second = buckets.slice(half).reduce((s, b) => s + b.count, 0);
  if (first === 0) return null;
  const change = ((second - first) / first) * 100;
  return { change, up: change >= 0 };
}

function formatAxisDate(value: string) {
  try {
    return format(parseISO(value), "dd MMM", { locale: es });
  } catch {
    return value;
  }
}

function ExportCsvButton({ csvUrl, range }: { csvUrl: string; range: DateRange }) {
  const [hovered, setHovered] = useState(false);
  const params = dateParams(range);

  return (
    <a
      href={`${csvUrl}?${params}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform duration-150 hover:scale-[1.02] active:scale-[0.96]"
    >
      <HoverMorphIcon idle={Download} active={Check} hovered={hovered} />
      Exportar CSV
    </a>
  );
}

export function EventAnalyticsPanel({
  heading,
  surface,
  dataUrl,
  csvUrl,
  emptyMessage,
  showBreakdowns,
}: EventAnalyticsPanelProps) {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [granularity, setGranularity] = useState<AnalyticsGranularity>("day");
  const [data, setData] = useState<PanelData>();
  const pluralLabel = surface === "qr" ? "Escaneos" : "Clics";
  const singularLabel = surface === "qr" ? "escaneo" : "clic";
  const uniqueTooltip =
    surface === "qr"
      ? "¿Cuántos dispositivos diferentes escanearon tu código QR?"
      : "¿Cuántos dispositivos diferentes hicieron clic en tu link?";
  const stats = data && data.buckets.length > 0 ? computeStats(data.buckets) : null;
  const trend = data && data.buckets.length > 0 ? computeTrend(data.buckets) : null;
  const year = range.to ? format(range.to, "yyyy") : "";

  useEffect(() => {
    let cancelled = false;
    const params = dateParams(range, granularity);

    fetch(`${dataUrl}?${params}`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((json: PanelData | undefined) => {
        if (!cancelled && json) setData(json);
      });

    return () => {
      cancelled = true;
    };
  }, [dataUrl, granularity, range]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-heading text-lg font-semibold">{heading}</h2>
          {year ? <span className="text-sm text-muted-foreground">{year}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <Select
            value={granularity}
            onValueChange={(value) => {
              if (value) setGranularity(value as AnalyticsGranularity);
            }}
          >
            <SelectTrigger aria-label={`Granularidad de ${heading.toLowerCase()}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="day">Día</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <ExportCsvButton csvUrl={csvUrl} range={range} />
        </div>
      </div>

      {data?.totals ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">{pluralLabel} totales</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-accent">{data.totals.total.toLocaleString()}</span>
              {trend ? (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${trend.up ? "text-emerald-500" : "text-red-500"}`}>
                  {trend.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {Math.abs(trend.change).toFixed(1)}% vs mitad anterior
                </span>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase">
              {singularLabel}s únicos
              <InfoTooltip label={uniqueTooltip}>
                <CircleHelp size={14} className="normal-case" />
              </InfoTooltip>
            </p>
            <span className="mt-1 block text-2xl font-bold text-primary">{data.totals.unique.toLocaleString()}</span>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">Promedio por {granularity === "day" ? "día" : granularity === "week" ? "semana" : "mes"}</p>
            <span className="mt-1 block text-2xl font-bold text-muted-foreground">{stats ? Math.round(stats.average) : 0}</span>
          </div>
        </div>
      ) : null}

      <div className="h-64 rounded-lg border border-border bg-card p-4">
        {data === undefined ? (
          <div className="flex h-full items-center justify-center">
            <BinaryLoader />
          </div>
        ) : data.buckets.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.buckets}>
              <defs>
                <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 12 }}
                stroke="var(--muted-foreground)"
                tickFormatter={formatAxisDate}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                // Dashed, subdued accent cursor line instead of Recharts' plain default.
                cursor={{ stroke: "var(--accent)", strokeDasharray: "4 4", strokeOpacity: 0.35 }}
                // Custom content instead of the default renderer: the Area and Line below share
                // dataKey="count" (the Area is a decorative fill under the line, not its own
                // series), so the default tooltip lists both as separate rows — "Escaneos: 6" and
                // "count: 6" for the same value. This renders exactly one row.
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  let dateLabel = label as string;
                  try {
                    dateLabel = format(parseISO(label as string), "dd MMM yyyy", { locale: es });
                  } catch {
                    // keep the raw label
                  }
                  return (
                    <div
                      className="rounded-md px-3 py-2 text-sm"
                      style={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <p className="text-muted-foreground">{dateLabel}</p>
                      <p style={{ color: "var(--accent)" }}>
                        {pluralLabel}: {payload[0].value}
                      </p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="count" stroke="none" fill="url(#countGradient)" />
              <ReferenceLine
                y={stats!.average}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: "Promedio",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                name={pluralLabel}
                stroke="var(--accent)"
                strokeWidth={2}
                filter="url(#lineGlow)"
                dot={(props) => {
                  const { cx = 0, cy = 0, index = -1 } = props;
                  const emphasized = index === stats!.minIndex || index === stats!.maxIndex;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={emphasized ? 5 : 3}
                      fill="var(--accent)"
                      stroke={emphasized ? "var(--background)" : undefined}
                      strokeWidth={emphasized ? 2 : undefined}
                    />
                  );
                }}
                activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--background)", strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>

      {showBreakdowns ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BreakdownList title="Países principales" rows={data?.countries} />
          <BreakdownList title="Ciudades principales" rows={data?.cities} />
          <BreakdownList title="Por dispositivo" rows={data?.devices} />
        </div>
      ) : null}
    </div>
  );
}

function BreakdownList({ title, rows }: { title: string; rows?: BreakdownRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
