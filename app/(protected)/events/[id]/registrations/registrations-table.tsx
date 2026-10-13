"use client";

import { useState } from "react";
import type { EventRegistrationRow, RegistrationWithAttendees } from "@/modules/events";
import { AddCompanionRow } from "./add-companion-row";
import { getPrimaryAttendee, getRegistrationTableValues } from "./registrations-table-model";
import { RegistrationDetailSheet } from "./registration-detail-sheet";

type Props = {
  registrations: RegistrationWithAttendees[];
  eventId: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  statusLabels: Record<EventRegistrationRow["status"], string>;
};

export function RegistrationsTable({
  registrations,
  eventId,
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
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Marca</th>
              <th className="px-4 py-3 font-medium">Intereses</th>
              <th className="px-4 py-3 font-medium">Acompañantes</th>
              <th className="px-4 py-3 font-medium">Pase</th>
              <th className="px-4 py-3 font-medium">Seguimiento</th>
              <th className="px-4 py-3 font-medium">Origen</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => {
              const primary = getPrimaryAttendee(registration);
              const values = getRegistrationTableValues(registration);
              const selected = selectedId === registration.id;

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
                    {primary?.email ? (
                      <a
                        href={`mailto:${primary.email}`}
                        className="block truncate text-xs text-muted-foreground underline underline-offset-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {primary.email}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{statusLabels[registration.status]}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {registration.createdAt.toLocaleString()}
                  </td>
                  <td className="max-w-44 truncate px-4 py-3">{values.brands}</td>
                  <td className="max-w-56 truncate px-4 py-3">{values.interests}</td>
                  <td className="px-4 py-3 text-center">{values.companionCount || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{values.pass}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {values.followUp ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                        Solicita más
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{values.source}</td>
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
          statusLabel={statusLabels[selectedRegistration.status]}
          open
          onOpenChange={(open) => !open && setSelectedId(null)}
          eventId={eventId}
          collectCompany={collectCompany}
          collectJobTitle={collectJobTitle}
        />
      ) : null}
    </>
  );
}
