import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { canAccessEvent, getEvent, getEventInsights } from "@/modules/events";
import { EventSubNav } from "../../event-sub-nav";

function formatConversion(conversion: number | null): string {
  // design.md's scan_rate convention (src/modules/campaigns/service.ts) — a dash, never a
  // misleading 0%, when there is nothing to divide by yet.
  return conversion === null ? "—" : `${Math.round(conversion * 100)}%`;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-semibold">{value}</span>
    </div>
  );
}

export default async function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: id, capability: "dashboard" }))) notFound();
  const [event, insights] = await Promise.all([
    getEvent(id, user.profile.organizationId),
    getEventInsights(id, user.profile.organizationId),
  ]);
  if (!event || !insights) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <EventSubNav eventId={id} current="dashboard" role={user.profile.role} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="font-heading text-xl font-semibold">Resultados: {event.name}</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Visitas" value={insights.visits} />
          <StatTile label="Registros" value={insights.registrations} />
          <StatTile label="Asistencia" value={insights.attendance} />
          <StatTile label="Conversión" value={formatConversion(insights.conversion)} />
        </div>
      </div>
    </div>
  );
}
