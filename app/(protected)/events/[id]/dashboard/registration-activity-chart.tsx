"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EventDashboardData } from "@/modules/events";

export function RegistrationActivityChart({ activity }: { activity: EventDashboardData["activity"] }) {
  const hasRegistrations = activity.some((point) => point.registrations > 0);

  return (
    <div className="h-72">
      {hasRegistrations ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              cursor={{ fill: "var(--accent)", fillOpacity: 0.08 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
                    <p className="text-muted-foreground">{label}</p>
                    <p className="font-medium text-accent-foreground">Registros: {payload[0]?.value}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="registrations" name="Registros" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Todavía no hay registros en los últimos 14 días.
        </div>
      )}
    </div>
  );
}
