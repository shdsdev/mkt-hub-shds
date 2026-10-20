import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { canAccessEvent, getEvent, listRegistrations, type EventRegistrationRow } from "@/modules/events";
import { EventSubNav } from "../../event-sub-nav";
import { RegistrationsTable } from "./registrations-table";
import { REVIEW_STATUS_LABELS } from "./review-status";

const STATUS_LABELS: Record<EventRegistrationRow["status"], string> = {
  pending_review: "Pendientes",
  confirmed: "Confirmado",
  waitlisted: "Lista de espera",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  checked_in: "Check-in",
};

// ADMIN-only, same gate as app/(protected)/events/page.tsx.
export default async function RegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "registrations" }))) notFound();

  const sp = await searchParams;
  const status = (sp.status as EventRegistrationRow["status"] | undefined) ?? undefined;
  const q = sp.q ?? undefined;
  const registrationId = sp.registrationId ?? undefined;

  const registrations = await listRegistrations(id, user.profile.organizationId, { status, q });

  const filterHref = (nextStatus?: EventRegistrationRow["status"]) => {
    const query = new URLSearchParams();
    if (nextStatus) query.set("status", nextStatus);
    if (q) query.set("q", q);
    const qs = query.toString();
    return `/events/${id}/registrations${qs ? `?${qs}` : ""}`;
  };
  const exportQuery = new URLSearchParams();
  if (status) exportQuery.set("status", status);
  if (q) exportQuery.set("q", q);
  const exportHref = `/events/${id}/registrations/export${exportQuery.toString() ? `?${exportQuery}` : ""}`;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <EventSubNav eventId={id} current="registrations" role={user.profile.role} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Registros: {event.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{registrations.length} resultado(s) con los filtros actuales</p>
        </div>
        <Link
          href={exportHref}
          className="rounded-md border border-border px-3 py-2 text-sm text-primary transition-colors hover:bg-card"
        >
          Exportar CSV
        </Link>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4">
       <form className="flex w-full flex-col gap-2 text-sm sm:flex-row sm:items-center lg:max-w-xl">
          <input type="hidden" name="status" value={status ?? ""} />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre o correo"
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
        />
        <button type="submit" className="h-10 rounded-md border border-border px-4 transition-colors hover:bg-card">
          Buscar
        </button>
      </form>

       <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-border bg-background p-1 text-sm" aria-label="Filtrar registros por situación">
         <Link href={filterHref(undefined)} className={`whitespace-nowrap rounded px-3 py-2 transition-colors ${!status ? "bg-card font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
           Todos
        </Link>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={filterHref(value as EventRegistrationRow["status"])}
            className={`whitespace-nowrap rounded px-3 py-2 transition-colors ${status === value ? "bg-card font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
           {label}
           </Link>
         ))}
       </div>
       </div>

      {registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay registros que coincidan.</p>
      ) : (
        <RegistrationsTable
          registrations={registrations}
          eventId={id}
          eventName={event.name}
          collectCompany={event.collectCompany}
          collectJobTitle={event.collectJobTitle}
          statusLabels={STATUS_LABELS}
          reviewStatusLabels={REVIEW_STATUS_LABELS}
          initialSelectedId={registrationId}
        />
      )}
    </div>
  );
}
