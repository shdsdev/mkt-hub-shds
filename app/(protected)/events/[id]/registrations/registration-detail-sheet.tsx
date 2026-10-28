"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MEXICAN_STATES } from "@/lib/events/mexican-states";
import type { RegistrationWithAttendees } from "@/modules/events";
import { getOccupationPresentation } from "@/lib/events/occupation-presentation";
import { CheckCircle2, Clock3, Tag, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCompanionRow } from "./add-companion-row";
import { AttendeeActions } from "./attendee-actions";
import { deleteRejectedRegistrationAction, updateRegistrationReviewStatusAction } from "./actions";
import { ResendInvitationButton } from "./resend-invitation-button";
import { REVIEW_STATUS_LABELS, type ReviewStatus } from "./review-status";
import { formatRegistrationDate } from "./registration-date";
import { AccessCodeCopyButton } from "./access-code-copy-button";

const UTM_LABELS: Record<string, string> = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmTerm: "utm_term",
  utmContent: "utm_content",
  utmId: "utm_id",
};

const OPTION_LABELS: Record<string, string> = {
  shades: "Shades",
  bmighty: "BMighty",
  drapery: "Drapery",
  "battery-motors": "Motores de baterías",
  "wifi-automation": "Motores WiFi y automatización",
  curtains: "Cortinería",
  "manual-and-motorized-rods": "Cortineros manuales y motorizados",
};
const STATE_LABELS = new Map<string, string>(MEXICAN_STATES.map((state) => [state.value, state.label]));

function ConsentStatus({ label, accepted, date }: { label: string; accepted: boolean; date?: string }) {
  const Icon = accepted ? CheckCircle2 : XCircle;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="font-medium">{label}</span>
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${accepted ? "text-emerald-300" : "text-red-400"}`}>
        <Icon className="size-4" />
        {accepted ? date ?? "Aceptado" : "No aceptado"}
      </span>
    </div>
  );
}

// The detail view keeps the table readable while presenting the full registration in a centered,
// wide modal that works better for scanning contact, preference, and attendee data together.
export function RegistrationDetailSheet({
  registration,
  statusLabel,
  open,
  onOpenChange,
  eventId,
  eventName,
  collectCompany,
  collectJobTitle,
  phoneRequired,
  canManageAttendees,
}: {
  registration: RegistrationWithAttendees;
  statusLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  phoneRequired: boolean;
  canManageAttendees: boolean;
}) {
  const [reviewState, reviewAction, reviewPending] = useActionState(updateRegistrationReviewStatusAction, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteRejectedRegistrationAction, {});
  const [reviewStatus, setReviewStatus] = useState(registration.reviewStatus);
  const [pendingReviewStatus, setPendingReviewStatus] = useState<ReviewStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();
  useEffect(() => setReviewStatus(registration.reviewStatus), [registration.reviewStatus]);
  useEffect(() => {
    if (!reviewState.success) return;
    setPendingReviewStatus(null);
    router.refresh();
  }, [reviewState.success, router]);
  useEffect(() => {
    if (!deleteState.success) return;
    setDeleteOpen(false);
    onOpenChange(false);
    router.refresh();
  }, [deleteState.success, onOpenChange, router]);
  function requestReviewStatus(status: ReviewStatus) {
    if (status === reviewStatus) return;
    setPendingReviewStatus(status);
  }
  const utmEntries = (Object.keys(UTM_LABELS) as (keyof typeof UTM_LABELS)[])
    .map((key) => [UTM_LABELS[key], registration[key as keyof RegistrationWithAttendees]] as const)
    .filter(([, value]) => Boolean(value));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {open ? <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-6xl flex-col overflow-y-auto rounded-2xl border border-border bg-popover px-5 py-8 text-popover-foreground shadow-2xl sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="pr-2 text-xl font-semibold tracking-tight">{registration.attendees.find((attendee) => attendee.isPrimary)?.fullName ?? "Registro"}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                {statusLabel} · {formatRegistrationDate(registration.createdAt)} · {registration.source === "admin_added" ? "Agregado por admin" : "Público"}
              </DialogPrimitive.Description>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button type="button" size="sm" onClick={() => requestReviewStatus("approved")} disabled={reviewPending || reviewStatus === "approved"}>Aprobar</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => requestReviewStatus("waitlisted")} disabled={reviewPending || reviewStatus === "waitlisted"}>Lista de espera</Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => requestReviewStatus("rejected")} disabled={reviewPending || reviewStatus === "rejected"}>Rechazar</Button>
              {registration.status === "rejected" ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setDeleteOpen(true)} disabled={deletePending}>Eliminar registro</Button>
              ) : null}
              {registration.status !== "cancelled" ? (
                <AddCompanionRow
                  registrationId={registration.id}
                  eventId={eventId}
                  collectCompany={collectCompany}
                  collectJobTitle={collectJobTitle}
                  phoneRequired={phoneRequired}
                />
              ) : null}
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)} aria-label="Cerrar detalle">
                <X data-icon="inline-start" />
              </Button>
            </div>
          </div>

          <DialogPrimitive.Root open={pendingReviewStatus !== null} onOpenChange={(open) => { if (!open || reviewPending) setPendingReviewStatus(null); }}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md" />
              <DialogPrimitive.Popup className="fixed inset-0 z-[60] m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl">
                <DialogPrimitive.Title className="text-lg font-semibold">Confirmar cambio</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                  ¿Seguro que querés marcar esta solicitud como {pendingReviewStatus ? REVIEW_STATUS_LABELS[pendingReviewStatus] : ""}?
                </DialogPrimitive.Description>
                <form action={reviewAction} className="mt-6 flex justify-end gap-2">
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="reviewStatus" value={pendingReviewStatus ?? reviewStatus} />
                  <Button type="button" variant="outline" onClick={() => setPendingReviewStatus(null)} disabled={reviewPending}>Cancelar</Button>
                  <Button type="submit" variant={pendingReviewStatus === "rejected" ? "destructive" : "default"} disabled={reviewPending}>{reviewPending ? "Guardando…" : "Confirmar"}</Button>
                </form>
              </DialogPrimitive.Popup>
            </DialogPrimitive.Portal>
           </DialogPrimitive.Root>

          <DialogPrimitive.Root open={deleteOpen} onOpenChange={(open) => { if (!open || !deletePending) setDeleteOpen(open); }}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md" />
              <DialogPrimitive.Popup className="fixed inset-0 z-[60] m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl">
                <DialogPrimitive.Title className="text-lg font-semibold">Eliminar registro rechazado</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
                  Esta acción eliminará permanentemente el registro y sus acompañantes. No se puede deshacer.
                </DialogPrimitive.Description>
                {deleteState.error ? <p role="alert" className="mt-3 text-sm text-destructive">{deleteState.error}</p> : null}
                <form action={deleteAction} className="mt-6 flex justify-end gap-2">
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <input type="hidden" name="eventId" value={eventId} />
                  <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deletePending}>Cancelar</Button>
                  <Button type="submit" variant="destructive" disabled={deletePending}>{deletePending ? "Eliminando…" : "Eliminar definitivamente"}</Button>
                </form>
              </DialogPrimitive.Popup>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          <div className="mt-6 flex flex-col gap-6 pb-4 text-sm">
          {reviewState.error ? <p role="alert" className="text-sm text-destructive">{reviewState.error}</p> : null}
          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Contacto</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Correo</p>
                <a href={`mailto:${registration.attendees.find((attendee) => attendee.isPrimary)?.email ?? ""}`} className="break-all text-sm font-medium underline underline-offset-2">
                  {registration.attendees.find((attendee) => attendee.isPrimary)?.email ?? "—"}
                </a>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Teléfono</p>
                <p className="text-sm font-medium">{registration.attendees.find((attendee) => attendee.isPrimary)?.phone ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Empresa</p>
                <p className="text-sm font-medium">{registration.attendees.find((attendee) => attendee.isPrimary)?.company ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Puesto</p>
                <p className="text-sm font-medium">{registration.attendees.find((attendee) => attendee.isPrimary)?.jobTitle ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3 sm:col-span-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Actividad profesional</p>
                <OccupationPill occupation={registration.attendees.find((attendee) => attendee.isPrimary)?.occupation} />
              </div>
            </div>
          </section>

          {utmEntries.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Origen (UTM)</h3>
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {utmEntries.map(([label, value]) => (
                  <li key={label}>
                    {label}: {String(value)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preferencias</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Seguimiento</p><p className="mt-1 font-semibold">{registration.requestedMoreCompanions ? "Solicita más acompañantes" : "Sin solicitud adicional"}</p></div>
                <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Marcas</p><p className="mt-1 font-semibold">{registration.clientBrands.length > 0 ? registration.clientBrands.map((value) => OPTION_LABELS[value] ?? value).join(", ") : "No cliente"}</p></div>
                <div className="sm:col-span-2"><p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Intereses</p><p className="mt-1 font-semibold">{registration.interests.length > 0 ? registration.interests.map((value) => OPTION_LABELS[value] ?? value).join(", ") : "Sin intereses seleccionados"}</p></div>
              </div>
              <div className="divide-y divide-border border-t border-border pt-2 text-xs">
                <ConsentStatus
                  label="Aviso de privacidad"
                  accepted={Boolean(registration.consents?.privacyAcceptedAt)}
                  date={registration.consents?.privacyAcceptedAt ? formatRegistrationDate(registration.consents.privacyAcceptedAt) : undefined}
                />
                <ConsentStatus
                  label="Términos y condiciones"
                  accepted={Boolean(registration.consents?.termsAcceptedAt)}
                  date={registration.consents?.termsAcceptedAt ? formatRegistrationDate(registration.consents.termsAcceptedAt) : undefined}
                />
                <ConsentStatus
                  label="Envío de publicidad"
                  accepted={Boolean(registration.consents?.marketingAcceptedAt)}
                  date={registration.consents?.marketingAcceptedAt ? formatRegistrationDate(registration.consents.marketingAcceptedAt) : undefined}
                />
              </div>
          </section>

          {Object.keys(registration.customFormAnswers).length > 0 ? (
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Respuestas del formulario</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(registration.customFormAnswers).map(([fieldId, answer]) => (
                  <div key={fieldId}>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{answer.label}</dt>
                    <dd className="mt-1 font-semibold">{formatCustomAnswer(answer.value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Asistentes ({registration.attendees.length})
            </h3>
            {registration.attendees.map((attendee) => (
              <div key={attendee.id} className={`flex flex-col gap-2 rounded-lg border p-4 ${attendee.checkedInAt ? "border-emerald-500/40 bg-emerald-500/10" : attendee.isActive === false ? "border-destructive/30 bg-destructive/5 opacity-70" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold">{attendee.fullName}</p>
                      {attendee.isPrimary ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Titular</span> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{attendee.email}</p><OccupationPill occupation={attendee.occupation} />
                  </div>
                  {attendee.checkedInAt ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300"><CheckCircle2 className="size-3.5" /> Dentro</span> : attendee.isActive === false ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive"><XCircle className="size-3.5" /> Inactivo</span> : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> Pendiente</span>}
                </div>
                {attendee.phone ? <p className="text-sm text-muted-foreground">Tel: {attendee.phone}</p> : null}
                {attendee.company ? (
                  <p className="text-muted-foreground">Empresa: {attendee.company}</p>
                ) : null}
                {attendee.jobTitle ? (
                  <p className="text-muted-foreground">Puesto: {attendee.jobTitle}</p>
                ) : null}
                {attendee.occupation ? (
                  <p className="text-muted-foreground">Actividad: {getOccupationPresentation(attendee.occupation).label}</p>
                ) : null}
                {attendee.state ? (
                  <p className="text-muted-foreground">Estado: {STATE_LABELS.get(attendee.state) ?? attendee.state}</p>
                ) : null}
                <AccessCodeCopyButton key={attendee.backupCode} code={attendee.backupCode} />
                <p className={`text-xs font-medium ${attendee.checkedInAt ? "text-emerald-300" : "text-muted-foreground"}`}>
                  {attendee.checkedInAt ? `Check-in: ${formatRegistrationDate(attendee.checkedInAt)}` : "Sin check-in"}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {attendee.isActive !== false ? (
                      <ResendInvitationButton eventId={eventId} attendeeId={attendee.id} />
                    ) : null}
                  </div>
                  {attendee.isActive !== false ? (
                    <AttendeeActions
                      registration={registration}
                      attendee={attendee}
                      eventId={eventId}
                      eventName={eventName}
                      collectCompany={collectCompany}
                      collectJobTitle={collectJobTitle}
                      phoneRequired={phoneRequired}
                       isPrimary={attendee.isPrimary}
                      canManage={canManageAttendees}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </section>

          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal> : null}
    </DialogPrimitive.Root>
  );
}

function OccupationPill({ occupation }: { occupation?: string | null }) {
  const presentation = getOccupationPresentation(occupation);
  return (
    <span className={`mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
      <Tag className="size-3.5" aria-hidden="true" />
      {presentation.label}
    </span>
  );
}

function formatCustomAnswer(value: string | number | boolean | string[] | null): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return value === null || value === "" ? "—" : String(value);
}
