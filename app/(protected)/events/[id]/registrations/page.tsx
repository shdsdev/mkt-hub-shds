import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { getEvent, listRegistrations, type EventRegistrationRow } from "@/modules/events";
import { EventSubNav } from "../../event-sub-nav";
import { RegistrationsTable } from "./registrations-table";

const STATUS_LABELS: Record<EventRegistrationRow["status"], string> = {
  confirmed: "Confirmado",
  waitlisted: "Lista de espera",
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
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();

  const sp = await searchParams;
  const status = (sp.status as EventRegistrationRow["status"] | undefined) ?? undefined;
  const q = sp.q ?? undefined;

  const registrations = await listRegistrations(id, user.profile.organizationId, { status, q });

  const filterHref = (nextStatus?: EventRegistrationRow["status"]) => {
    const query = new URLSearchParams();
    if (nextStatus) query.set("status", nextStatus);
    if (q) query.set("q", q);
    const qs = query.toString();
    return `/events/${id}/registrations${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <EventSubNav eventId={id} current="registrations" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Registros: {event.name}</h1>
          <p className="text-sm text-muted-foreground">{registrations.length} resultado(s)</p>
        </div>
        <Link
          href={`/events/${id}/registrations/export${status || q ? `?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) }).toString()}` : ""}`}
          className="text-sm text-primary underline"
        >
          Exportar CSV
        </Link>
      </div>

      <form className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="status" value={status ?? ""} />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre o correo"
          className="rounded-md border border-input bg-transparent px-3 py-1.5"
        />
        <button type="submit" className="rounded-md border border-border px-3 py-1.5">
          Buscar
        </button>
      </form>

      <div className="flex gap-2 text-sm">
        <Link href={filterHref(undefined)} className={!status ? "font-medium underline" : "text-muted-foreground"}>
          Todos
        </Link>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={filterHref(value as EventRegistrationRow["status"])}
            className={status === value ? "font-medium underline" : "text-muted-foreground"}
          >
            {label}
          </Link>
        ))}
      </div>

      {registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay registros que coincidan.</p>
      ) : (
        <RegistrationsTable
          registrations={registrations}
          eventId={id}
          collectCompany={event.collectCompany}
          collectJobTitle={event.collectJobTitle}
          statusLabels={STATUS_LABELS}
        />
      )}
    </div>
  );
}
