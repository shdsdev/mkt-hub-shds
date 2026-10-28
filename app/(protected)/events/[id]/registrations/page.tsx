import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { canAccessEvent, getEvent, listRegistrations, resolveRegistrationFormConfig, type EventRegistrationRow } from "@/modules/events";
import { EventSubNav } from "../../event-sub-nav";
import { RegistrationsTable } from "./registrations-table";
import { REVIEW_STATUS_LABELS } from "./review-status";
import { getPrimaryAttendee, getRegistrationSourceDisplayLabel } from "./registrations-table-model";
import { RegistrationFilters } from "./registration-filters";

const STATUS_LABELS: Record<EventRegistrationRow["status"], string> = {
  pending_review: "Pendientes",
  confirmed: "Confirmado",
  waitlisted: "Lista de espera",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  checked_in: "Check-in",
};

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type SortOption = "recent" | "oldest" | "name" | "company";

function parsePageSize(value: string | undefined): number {
  const parsed = Number(value);
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : 25;
}

function parsePage(value: string | undefined, pageCount: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, pageCount) : 1;
}

function buildQuery(values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

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
  const reviewStatus = sp.reviewStatus;
  const q = sp.q ?? undefined;
  const source = sp.source ?? undefined;
  const occupation = sp.occupation ?? undefined;
  const state = sp.state ?? undefined;
  const sort = (sp.sort as SortOption | undefined) ?? "recent";
  const pageSize = parsePageSize(sp.pageSize);
  const registrationId = sp.registrationId ?? undefined;

  const registrations = await listRegistrations(id, user.profile.organizationId, { status, reviewStatus: reviewStatus as EventRegistrationRow["reviewStatus"] | undefined, q });
  const filteredRegistrations = registrations.filter((registration) => {
    const primary = getPrimaryAttendee(registration);
    return (
      (!source || getRegistrationSourceDisplayLabel(registration).toLowerCase() === source.toLowerCase()) &&
      (!occupation || primary?.occupation === occupation) &&
      (!state || primary?.state === state)
    );
  });
  const sortedRegistrations = [...filteredRegistrations].sort((left, right) => {
    if (sort === "name") return (getPrimaryAttendee(left)?.fullName ?? "").localeCompare(getPrimaryAttendee(right)?.fullName ?? "", "es");
    if (sort === "company") return (getPrimaryAttendee(left)?.company ?? "").localeCompare(getPrimaryAttendee(right)?.company ?? "", "es");
    const difference = left.createdAt.getTime() - right.createdAt.getTime();
    return sort === "oldest" ? difference : -difference;
  });
  const pageCount = Math.max(1, Math.ceil(sortedRegistrations.length / pageSize));
  const currentPage = parsePage(sp.page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedRegistrations = sortedRegistrations.slice(pageStart, pageStart + pageSize);
  const currentQuery = { status, reviewStatus, q, source, occupation, state, sort, pageSize: String(pageSize) };

  const filterHref = (nextStatus?: EventRegistrationRow["status"]) => {
    return `/events/${id}/registrations${buildQuery({ ...currentQuery, status: nextStatus, page: undefined })}`;
  };
  const exportHref = `/events/${id}/registrations/export${buildQuery(currentQuery)}`;
  const pageHref = (nextPage: number) => `/events/${id}/registrations${buildQuery({ ...currentQuery, page: String(nextPage) })}`;
  const pageNumbers = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, pageCount]))
    .filter((page) => page > 0 && page <= pageCount)
    .sort((left, right) => left - right);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <EventSubNav eventId={id} current="registrations" role={user.profile.role} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Registros: {event.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sortedRegistrations.length} resultado(s) con los filtros actuales</p>
        </div>
        <Link
          href={exportHref}
          className="rounded-md border border-border px-3 py-2 text-sm text-primary transition-colors hover:bg-card"
        >
          Exportar CSV
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-3">
       <RegistrationFilters
         status={status}
         q={q}
         reviewStatus={reviewStatus}
         source={source}
         occupation={occupation}
         state={state}
         sort={sort}
         pageSize={pageSize}
       />
       <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-border bg-background p-1 text-sm" aria-label="Filtrar registros por situación">
         <Link href={filterHref(undefined)} aria-current={!status ? "page" : undefined} className={`whitespace-nowrap rounded px-3 py-2 transition-colors ${!status ? "registration-filter-active font-medium" : "registration-filter-option text-muted-foreground"}`}>
           Todos
        </Link>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={filterHref(value as EventRegistrationRow["status"])}
            aria-current={status === value ? "page" : undefined}
            className={`whitespace-nowrap rounded px-3 py-2 transition-colors ${status === value ? "registration-filter-active font-medium" : "registration-filter-option text-muted-foreground"}`}
          >
           {label}
           </Link>
         ))}
       </div>
       </div>

      {paginatedRegistrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay registros que coincidan.</p>
      ) : (
        <RegistrationsTable
          registrations={paginatedRegistrations}
          eventId={id}
          eventName={event.name}
          collectCompany={event.collectCompany}
          collectJobTitle={event.collectJobTitle}
          phoneRequired={resolveRegistrationFormConfig(event).fields.phone.required}
          statusLabels={STATUS_LABELS}
          reviewStatusLabels={REVIEW_STATUS_LABELS}
          initialSelectedId={registrationId}
        />
      )}
      {sortedRegistrations.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Mostrando {pageStart + 1}–{Math.min(pageStart + pageSize, sortedRegistrations.length)} de {sortedRegistrations.length}</span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Link href={pageHref(Math.max(1, currentPage - 1))} aria-disabled={currentPage === 1} className={`rounded-md border border-border px-3 py-2 ${currentPage === 1 ? "pointer-events-none opacity-40" : "hover:bg-card"}`}>Anterior</Link>
            <div className="hidden items-center gap-1 sm:flex" aria-label="Seleccionar página">
              {pageNumbers.map((page) => (
                <Link
                  key={page}
                  href={pageHref(page)}
                  aria-current={page === currentPage ? "page" : undefined}
                  className={`inline-flex size-9 items-center justify-center rounded-md border border-border ${page === currentPage ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-card"}`}
                >
                  {page}
                </Link>
              ))}
            </div>
            <span>Página {currentPage} de {pageCount}</span>
            <Link href={pageHref(Math.min(pageCount, currentPage + 1))} aria-disabled={currentPage === pageCount} className={`rounded-md border border-border px-3 py-2 ${currentPage === pageCount ? "pointer-events-none opacity-40" : "hover:bg-card"}`}>Siguiente</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
