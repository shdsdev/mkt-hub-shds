"use client";

import { useEffect, useState } from "react";
import { format, parseISO, subDays } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "./stat-card";
import { OrgTrendChart } from "./org-trend-chart";
import { DeviceDonut } from "./device-donut";
import { LocationTable, countryFlag } from "./location-table";
import { ReferrerList } from "./referrer-list";
import { OrgMap } from "./org-map";
import type { AnalyticsSurface } from "@/modules/analytics";

type BreakdownRow = { label: string; count: number };
type Bucket = { bucket: string; count: number };

type DashboardData = {
  trend: Bucket[];
  previousTrend: Bucket[];
  totals: { current: number; previous: number; percentChange: number | null };
  bestDay: { date: string; count: number; percentChange: number | null; previous: number } | null;
  bestLocation: { country: string; count: number; percentChange: number | null; previous: number } | null;
  devices: BreakdownRow[];
  countries: BreakdownRow[];
  referrers: BreakdownRow[];
};

function formatBestDayDate(date: string): string {
  try {
    return format(parseISO(date), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return date;
  }
}

function defaultRange(): DateRange {
  const to = new Date();
  return { from: subDays(to, 29), to };
}

const SURFACE_LABELS: Record<AnalyticsSurface, string> = { links: "Enlaces", qr: "Códigos QR" };
const PLURAL_LABELS: Record<AnalyticsSurface, string> = { links: "Clics", qr: "Escaneos" };

// Owns the source selector and date range — the shared calendar/range component the per-link
// chart already uses, but with its own state, not synced across pages. Every widget re-fetches
// together from /analytics/data whenever either changes, since the selector switches which data
// feeds the whole layout at once (never blends both surfaces).
export function OrgDashboard() {
  const [surface, setSurface] = useState<AnalyticsSurface>("links");
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [data, setData] = useState<DashboardData>();

  const fromParam = range.from ? format(range.from, "yyyy-MM-dd") : undefined;
  const toParam = range.to ? format(range.to, "yyyy-MM-dd") : undefined;

  useEffect(() => {
    if (!fromParam || !toParam) return;
    let cancelled = false;

    const params = new URLSearchParams({ surface, granularity: "day", from: fromParam, to: toParam });

    fetch(`/analytics/data?${params}`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((json: DashboardData | undefined) => {
        if (!cancelled && json) setData(json);
      });

    return () => {
      cancelled = true;
    };
  }, [surface, fromParam, toParam]);

  const bestDayValue = data?.bestDay ? data.bestDay.count.toLocaleString() : null;
  const bestLocationValue = data?.bestLocation
    ? `${data.bestLocation.country} · ${data.bestLocation.count.toLocaleString()}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">Analytics</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={surface}
            onValueChange={(value) => {
              if (value) setSurface(value as AnalyticsSurface);
            }}
          >
            <SelectTrigger aria-label="Fuente de datos">
              <SelectValue>{SURFACE_LABELS[surface]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="links">Enlaces</SelectItem>
                <SelectItem value="qr">Códigos QR</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Mejor día por interacciones"
          value={bestDayValue}
          dateLabel={data?.bestDay ? formatBestDayDate(data.bestDay.date) : undefined}
          percentChange={data?.bestDay?.percentChange ?? null}
          previous={data?.bestDay?.previous}
          comparisonLabel="promedio del período anterior"
        />
        <StatCard
          label="Mejor ubicación por interacciones"
          value={bestLocationValue}
          flag={data?.bestLocation ? countryFlag(data.bestLocation.country) : undefined}
          percentChange={data?.bestLocation?.percentChange ?? null}
          previous={data?.bestLocation?.previous}
          comparisonLabel="período anterior"
        />
      </div>

      <OrgTrendChart
        trend={data?.trend}
        previousTrend={data?.previousTrend}
        pluralLabel={PLURAL_LABELS[surface]}
        loading={data === undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DeviceDonut rows={data?.devices} />
        <LocationTable rows={data?.countries} surface={surface} from={fromParam ?? ""} to={toParam ?? ""} />
      </div>

      <ReferrerList rows={data?.referrers} />

      <OrgMap rows={data?.countries} />
    </div>
  );
}
