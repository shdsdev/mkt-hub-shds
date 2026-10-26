"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventRegistrationRow, RegistrationWithAttendees } from "@/modules/events";
import { getOccupationPresentation } from "@/lib/events/occupation-presentation";
import { Megaphone, Tag } from "lucide-react";
import { AddCompanionRow } from "./add-companion-row";
import { getPrimaryAttendee, getRegistrationSourceLabel, getRegistrationTableValues } from "./registrations-table-model";
import { RegistrationDetailSheet } from "./registration-detail-sheet";
import { formatRegistrationDate } from "./registration-date";

type Props = {
  registrations: RegistrationWithAttendees[];
  eventId: string;
  eventName: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  statusLabels: Record<EventRegistrationRow["status"], string>;
  reviewStatusLabels: Record<EventRegistrationRow["reviewStatus"], string>;
  initialSelectedId?: string;
};

function statusBadgeClass(status: string): string {
  if (status === "Check-in") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  if (status === "Pendientes") return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200";
  if (status === "Confirmadas") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  if (status === "Rechazadas" || status === "Canceladas") return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200";
  return "border-border bg-muted text-foreground";
}

function reviewBadgeClass(status: string): string {
  if (status === "Nuevo") return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200";
  if (status === "Aprobado") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  if (status === "Rechazado") return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200";
  return "border-border bg-muted text-foreground";
}

export function RegistrationsTable({
  registrations,
  eventId,
  eventName,
  collectCompany,
  collectJobTitle,
  statusLabels,
  reviewStatusLabels,
  initialSelectedId,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const selectedRegistration = registrations.find(({ id }) => id === selectedId) ?? null;

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [router]);

  function selectRegistration(id: string) {
    setSelectedId(id);
  }

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectRegistration(id);
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-[1240px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Tipo de cliente</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Revisión</th>
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Marca</th>
              <th className="px-4 py-3 font-medium">Seguimiento</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => {
              const primary = getPrimaryAttendee(registration);
              const values = getRegistrationTableValues(registration);
              const selected = selectedId === registration.id;
              const displayStatus = registration.status === "cancelled"
                ? statusLabels[registration.status]
                : values.status === "Check-in"
                  ? statusLabels.checked_in
                  : values.status === "Confirmado"
                    ? statusLabels.confirmed
                    : statusLabels[registration.status];

              return (
                <tr
                  key={registration.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir registro de ${primary?.fullName ?? "contacto sin nombre"}`}
                  className={`cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-card focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selected ? "bg-card" : ""}`}
                  onClick={() => selectRegistration(registration.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, registration.id)}
                >
                  <td className="max-w-56 px-4 py-3">
                    <strong className="block truncate font-medium">{primary?.fullName ?? "—"}</strong>
                    {primary?.email ? <span className="block truncate text-xs text-muted-foreground">{primary.email}</span> : null}
                  </td>
                  <td className="max-w-48 truncate px-4 py-3">{primary?.company ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{values.state}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatRegistrationDate(registration.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {primary?.occupation ? (() => { const presentation = getOccupationPresentation(primary.occupation); return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}><Tag className="size-3.5" aria-hidden="true" />{presentation.label}</span>; })() : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(displayStatus)}`}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${reviewBadgeClass(reviewStatusLabels[registration.reviewStatus])}`}>
                      {reviewStatusLabels[registration.reviewStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getRegistrationSourceLabel(registration) === "Meta Ads" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
                        <Megaphone className="size-3.5" aria-hidden="true" />
                        Meta Ads
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{getRegistrationSourceLabel(registration)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{values.isClient ? "Cliente" : "No cliente"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {values.followUp ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                        Solicita más acompañantes
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    {registration.status !== "cancelled" ? (
                      <AddCompanionRow
                        registrationId={registration.id}
                        eventId={eventId}
                        collectCompany={collectCompany}
                        collectJobTitle={collectJobTitle}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRegistration ? (
        <RegistrationDetailSheet
          registration={selectedRegistration}
          statusLabel={selectedRegistration.status === "cancelled"
            ? statusLabels[selectedRegistration.status]
            : getRegistrationTableValues(selectedRegistration).status === "Check-in"
              ? statusLabels.checked_in
              : getRegistrationTableValues(selectedRegistration).status === "Confirmado"
                ? statusLabels.confirmed
                : statusLabels[selectedRegistration.status]}
          open
          onOpenChange={(open) => !open && setSelectedId(null)}
          eventId={eventId}
          eventName={eventName}
          collectCompany={collectCompany}
          collectJobTitle={collectJobTitle}
        />
      ) : null}
    </>
  );
}
