"use client";

import { useState } from "react";
import type { EventRegistrationRow, RegistrationWithAttendees } from "@/modules/events";
import { AddCompanionRow } from "./add-companion-row";
import { getPrimaryAttendee, getRegistrationTableValues } from "./registrations-table-model";
import { RegistrationDetailSheet } from "./registration-detail-sheet";
import { formatRegistrationDate } from "./registration-date";

type Props = {
  registrations: RegistrationWithAttendees[];
  eventId: string;
  eventName: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  statusLabels: Record<EventRegistrationRow["status"], string>;
};

export function RegistrationsTable({
  registrations,
  eventId,
  eventName,
  collectCompany,
  collectJobTitle,
  statusLabels,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRegistration = registrations.find(({ id }) => id === selectedId) ?? null;

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
        <table className="min-w-[1120px] w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Status</th>
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
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatRegistrationDate(registration.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{displayStatus}</td>
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
