import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { canAccessEvent, getEvent, getEventDashboardData, getEventInsights, type EventDashboardStatus } from "@/modules/events";
import { EventSubNav } from "../../event-sub-nav";
import { RegistrationActivityChart } from "./registration-activity-chart";

function formatConversion(conversion: number | null): string {
  // design.md's scan_rate convention (src/modules/campaigns/service.ts) — a dash, never a
  // misleading 0%, when there is nothing to divide by yet.
  return conversion === null ? "—" : `${Math.round(conversion * 100)}%`;
}

function formatConfirmedSeats(confirmedSeats: number, capacity: number | null): string {
  return capacity === null ? `${confirmedSeats}` : `${confirmedSeats} / ${capacity}`;
}

function formatCompanies(companies: number | null): string {
  return companies === null ? "No se recopila" : `${companies}`;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-semibold">{value}</span>
    </div>
  );
}

function ConfirmedSeatsTile({ confirmedSeats, capacity }: { confirmedSeats: number; capacity: number | null }) {
  const isFull = capacity !== null && confirmedSeats >= capacity;
  const progress = capacity === null || capacity <= 0 ? 0 : Math.min(100, Math.round((confirmedSeats / capacity) * 100));
  const valueClass = isFull ? "text-destructive" : "text-foreground";
  const barClass = isFull ? "bg-destructive" : "bg-accent";

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Personas confirmadas</p>
          <p className={`mt-1 font-heading text-3xl font-semibold tracking-tight ${valueClass}`}>
            {formatConfirmedSeats(confirmedSeats, capacity)}
          </p>
        </div>
        {capacity !== null ? (
          <div className="w-full max-w-md space-y-2 sm:min-w-[280px]">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={capacity}
              aria-valuenow={Math.min(confirmedSeats, capacity)}
              aria-label={`${progress}% del cupo ocupado`}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className={`h-full rounded-full transition-[width] ${barClass}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className={isFull ? "text-destructive" : "text-muted-foreground"}>{isFull ? "Cupo lleno" : "Cupo disponible"}</span>
              <span className="text-muted-foreground">{progress}% del cupo</span>
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Cupo ilimitado</span>
        )}
      </div>
    </section>
  );
}

const statusLabels: Record<EventDashboardStatus, string> = {
  pending_review: "Pendientes",
  confirmed: "Confirmadas",
  waitlisted: "Lista de espera",
  rejected: "Rechazadas",
  cancelled: "Canceladas",
};

const registrationStatusLabels: Record<string, string> = {
  pending_review: "Pendiente",
  confirmed: "Confirmado",
  checked_in: "Check-in",
  waitlisted: "Lista de espera",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

const reviewStatusLabels: Record<string, string> = {
  new: "Por revisar",
  approved: "Aprobado",
  rejected: "Rechazado",
};

function formatRecentDate(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

function DashboardSection({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default async function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: id, capability: "dashboard" }))) notFound();
  const [event, insights, dashboard] = await Promise.all([
    getEvent(id, user.profile.organizationId),
    getEventInsights(id, user.profile.organizationId),
    getEventDashboardData(id, user.profile.organizationId),
  ]);
  if (!event || !insights || !dashboard) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <EventSubNav eventId={id} current="dashboard" role={user.profile.role} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Resultados: {event.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Una lectura rápida del rendimiento y la operación de tu evento.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Visitas" value={insights.visits} />
          <StatTile label="Registros" value={insights.registrations} />
          <StatTile label="Personas registradas" value={insights.people} />
          <StatTile label="Empresas registradas" value={formatCompanies(insights.companies)} />
          <StatTile label="Asistencia" value={insights.attendance} />
          <StatTile label="Conversión" value={formatConversion(insights.conversion)} />
        </div>

        <ConfirmedSeatsTile confirmedSeats={insights.confirmedSeats} capacity={insights.capacity} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <DashboardSection title="Actividad de registros">
              <p className="mt-1 text-sm text-muted-foreground">Solicitudes recibidas durante los últimos 14 días.</p>
              <div className="mt-4">
                <RegistrationActivityChart activity={dashboard.activity} />
              </div>
            </DashboardSection>

            <DashboardSection title="Últimos registros">
              {dashboard.recentRegistrations.length > 0 ? (
                <div className="mt-4 divide-y divide-border">
                  {dashboard.recentRegistrations.map((registration) => (
                    <Link key={registration.id} href={`/events/${id}/registrations`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{registration.primaryName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatRecentDate(registration.createdAt)} · {registration.attendeeCount} {registration.attendeeCount === 1 ? "persona" : "personas"}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-foreground">{registrationStatusLabels[registration.status]}</p>
                        <p className="mt-1 text-muted-foreground">{reviewStatusLabels[registration.reviewStatus] ?? registration.reviewStatus}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Todavía no hay registros para mostrar.</p>
              )}
            </DashboardSection>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <DashboardSection title="Requiere atención">
              <div className="mt-4 divide-y divide-border">
                {[
                  { label: "Solicitudes pendientes", value: dashboard.attention.pendingReview, href: `/events/${id}/registrations` },
                  { label: "Personas en lista de espera", value: dashboard.attention.waitlisted, href: `/events/${id}/registrations` },
                  { label: "Confirmados sin check-in", value: dashboard.attention.confirmedWithoutCheckIn, href: `/events/${id}/registrations` },
                  { label: "Solicitan acompañantes", value: dashboard.attention.requestedCompanions, href: `/events/${id}/registrations` },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 py-3 outline-none transition-colors first:pt-0 last:pb-0 hover:text-foreground focus-visible:text-foreground">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={`font-heading text-lg font-semibold ${item.value > 0 ? "text-accent" : "text-muted-foreground"}`}>{item.value}</span>
                  </Link>
                ))}
              </div>
            </DashboardSection>

            <DashboardSection title="Estado de registros">
              <div className="mt-4 space-y-3">
                {dashboard.statuses.map((item) => (
                  <div key={item.status} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{statusLabels[item.status]}</span>
                    <span className="font-medium text-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </DashboardSection>
          </aside>
        </div>
      </div>
    </div>
  );
}
