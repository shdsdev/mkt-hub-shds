"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventRegistrationRow, RegistrationWithAttendees } from "@/modules/events";
import { getOccupationPresentation } from "@/lib/events/occupation-presentation";
import { Camera, Globe2, Mail, Megaphone, MessageCircle, Search, ShieldCheck, Tag } from "lucide-react";
import { AddCompanionRow } from "./add-companion-row";
import { getPrimaryAttendee, getRegistrationSourceBadgeClass, getRegistrationSourceDisplayLabel, getRegistrationSourceLabel, getRegistrationTableValues } from "./registrations-table-model";
import { RegistrationDetailSheet } from "./registration-detail-sheet";
import { formatRegistrationDate } from "./registration-date";

type Props = {
  registrations: RegistrationWithAttendees[];
  eventId: string;
  eventName: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  phoneRequired: boolean;
  statusLabels: Record<EventRegistrationRow["status"], string>;
  reviewStatusLabels: Record<EventRegistrationRow["reviewStatus"], string>;
  canManageAttendees: boolean;
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

function SourceIcon({ source }: { source: string }) {
  const normalized = source.toLowerCase();
  const Icon = normalized.includes("whatsapp")
    ? MessageCircle
    : normalized.includes("instagram")
      ? Camera
      : normalized.includes("google")
        ? Search
        : normalized.includes("email") || normalized.includes("mail")
          ? Mail
          : normalized.includes("admin")
            ? ShieldCheck
            : normalized === "sitio web"
              ? Globe2
              : normalized === "meta ads"
                ? Megaphone
                : Tag;

  return <Icon className="size-3.5" aria-hidden="true" />;
}

export function RegistrationsTable({
  registrations,
  eventId,
  eventName,
  collectCompany,
  collectJobTitle,
  phoneRequired,
  statusLabels,
  reviewStatusLabels,
  canManageAttendees,
  initialSelectedId,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startScrollLeft: 0 });
  const suppressClickRef = useRef(false);
  const selectedRegistration = registrations.find(({ id }) => id === selectedId) ?? null;

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !selectedId) router.refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [router, selectedId]);

  useEffect(() => setSelectedId(initialSelectedId ?? null), [initialSelectedId]);

  function updateSelectedRegistration(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("registrationId", id);
    else params.delete("registrationId");
    const serialized = params.toString();
    router.replace(`${pathname}${serialized ? `?${serialized}` : ""}`, { scroll: false });
    setSelectedId(id);
  }

  function selectRegistration(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    updateSelectedRegistration(id);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea")) return;

    const container = event.currentTarget;
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active) return;

    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) {
      drag.moved = true;
      setIsDragging(true);
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
  }

  function endPointerDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active) return;

    if (drag.moved) suppressClickRef.current = true;
    dragRef.current.active = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectRegistration(id);
  }

  return (
    <>
      <div className="sm:hidden">
        <div className="grid gap-2" aria-label="Registros">
          {registrations.map((registration) => {
            const primary = getPrimaryAttendee(registration);
            const values = getRegistrationTableValues(registration);
            const displayStatus = registration.status === "cancelled"
              ? statusLabels[registration.status]
              : values.status === "Check-in"
                ? statusLabels.checked_in
                : values.status === "Confirmado"
                  ? statusLabels.confirmed
                  : statusLabels[registration.status];

            return (
              <article key={registration.id} className={`rounded-lg border border-border bg-card p-3 ${selectedId === registration.id ? "ring-2 ring-primary/50" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => selectRegistration(registration.id)}
                    aria-label={`Abrir registro de ${primary?.fullName ?? "contacto sin nombre"}`}
                  >
                    <strong className="block truncate font-medium">{primary?.fullName ?? "—"}</strong>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{primary?.email ?? "Sin correo"}</span>
                  </button>
                  {registration.status !== "cancelled" ? (
                    <AddCompanionRow registrationId={registration.id} eventId={eventId} collectCompany={collectCompany} collectJobTitle={collectJobTitle} phoneRequired={phoneRequired} />
                  ) : null}
                </div>
                <button type="button" className="mt-3 grid w-full grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => selectRegistration(registration.id)}>
                  <span className="min-w-0"><span className="block text-xs text-muted-foreground">Estado</span><strong className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(displayStatus)}`}>{displayStatus}</strong></span>
                  <span className="min-w-0"><span className="block text-xs text-muted-foreground">Fecha</span><strong className="mt-1 block truncate font-medium text-foreground">{formatRegistrationDate(registration.createdAt)}</strong></span>
                  <span className="min-w-0"><span className="block text-xs text-muted-foreground">Estado de revisión</span><strong className="mt-1 block truncate font-medium text-foreground">{reviewStatusLabels[registration.reviewStatus]}</strong></span>
                  <span className="min-w-0"><span className="block text-xs text-muted-foreground">Ubicación</span><strong className="mt-1 block truncate font-medium text-foreground">{values.state}</strong></span>
                </button>
              </article>
            );
          })}
        </div>
      </div>
      <div
        ref={scrollRef}
        className={`hidden max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-border touch-auto sm:block ${isDragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
      >
          <table className="w-full min-w-[760px] text-left text-sm xl:min-w-[1240px]">
          <thead>
            <tr className="border-b border-border bg-background text-xs text-muted-foreground">
              <th className="sticky left-0 top-0 z-30 bg-background px-4 py-3 font-medium">Nombre</th>
              <th className="sticky top-0 z-20 hidden bg-background px-4 py-3 font-medium xl:table-cell">Empresa</th>
              <th className="sticky top-0 z-20 bg-background px-4 py-3 font-medium">Estado</th>
              <th className="sticky top-0 z-20 bg-background px-4 py-3 font-medium">Fecha</th>
              <th className="sticky top-0 z-20 hidden bg-background px-4 py-3 font-medium xl:table-cell">Tipo de cliente</th>
              <th className="sticky top-0 z-20 bg-background px-4 py-3 font-medium">Status</th>
              <th className="sticky top-0 z-20 bg-background px-4 py-3 font-medium">Revisión</th>
              <th className="sticky top-0 z-20 hidden bg-background px-4 py-3 font-medium xl:table-cell">Fuente</th>
              <th className="sticky top-0 z-20 hidden bg-background px-4 py-3 font-medium xl:table-cell">Marca</th>
              <th className="sticky top-0 z-20 hidden bg-background px-4 py-3 font-medium xl:table-cell">Seguimiento</th>
              <th className="sticky top-0 z-20 bg-background px-4 py-3 font-medium">Acciones</th>
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
                  <td className="sticky left-0 z-10 max-w-56 bg-background px-4 py-3">
                    <strong className="block truncate font-medium">{primary?.fullName ?? "—"}</strong>
                    {primary?.email ? <span className="block truncate text-xs text-muted-foreground">{primary.email}</span> : null}
                  </td>
                  <td className="hidden max-w-48 truncate px-4 py-3 xl:table-cell">{primary?.company ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{values.state}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatRegistrationDate(registration.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {primary?.occupation ? (() => { const presentation = getOccupationPresentation(primary.occupation); return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}><Tag className="size-3.5" aria-hidden="true" />{presentation.label}</span>; })() : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap xl:table-cell">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(displayStatus)}`}>
                      {displayStatus}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap xl:table-cell">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${reviewBadgeClass(reviewStatusLabels[registration.reviewStatus])}`}>
                      {reviewStatusLabels[registration.reviewStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const sourceLabel = getRegistrationSourceDisplayLabel(registration);
                      const originalSource = getRegistrationSourceLabel(registration);
                      return (
                        <span title={originalSource !== sourceLabel ? originalSource : undefined} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getRegistrationSourceBadgeClass(sourceLabel)}`}>
                          <SourceIcon source={sourceLabel} />
                          {sourceLabel}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap xl:table-cell">{values.isClient ? "Cliente" : "No cliente"}</td>
                  <td className="hidden px-4 py-3 whitespace-nowrap xl:table-cell">
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
                        phoneRequired={phoneRequired}
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
          onOpenChange={(open) => !open && updateSelectedRegistration(null)}
          eventId={eventId}
          eventName={eventName}
          collectCompany={collectCompany}
          collectJobTitle={collectJobTitle}
          phoneRequired={phoneRequired}
          canManageAttendees={canManageAttendees}
        />
      ) : null}
    </>
  );
}
