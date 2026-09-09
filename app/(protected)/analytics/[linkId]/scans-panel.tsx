"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScanGranularity, ScanBucket, BreakdownRow } from "@/modules/analytics";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

type DataResponse = {
  buckets: ScanBucket[];
  devices: BreakdownRow[];
  countries: BreakdownRow[];
  cities: BreakdownRow[];
};

export function ScansPanel({ linkId }: { linkId: string }) {
  const initialRange = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [granularity, setGranularity] = useState<ScanGranularity>("day");
  const [data, setData] = useState<DataResponse>();

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ granularity, from, to });

    fetch(`/analytics/${linkId}/data?${params}`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((json) => {
        if (!cancelled && json) setData(json);
      });

    return () => {
      cancelled = true;
    };
  }, [linkId, granularity, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">Scans</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <select
            value={granularity}
            onChange={(event) => setGranularity(event.target.value as ScanGranularity)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <a
            href={`/analytics/${linkId}/csv`}
            className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
          >
            Export CSV
          </a>
        </div>
      </div>

      <div className="h-64 rounded-lg border border-border bg-card p-4">
        {data && data.buckets.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.buckets}>
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <Bar dataKey="scansHuman" name="Scans" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No scans in this range yet.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BreakdownList title="Top countries" rows={data?.countries} />
        <BreakdownList title="Top cities" rows={data?.cities} />
        <BreakdownList title="By device" rows={data?.devices} />
      </div>
    </div>
  );
}

function BreakdownList({ title, rows }: { title: string; rows?: BreakdownRow[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data in this range.</p>
      ) : (
        <ul className="space-y-1 text-sm">
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
