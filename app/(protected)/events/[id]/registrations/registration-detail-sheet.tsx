"use client";

import { useActionState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { RegistrationWithAttendees } from "@/modules/events";
import { CheckCircle2, Clock3, Mail, MessageCircle, Phone, XCircle } from "lucide-react";
import { AddCompanionRow } from "./add-companion-row";
import { resendInvitationAction, type ResendInvitationState } from "./actions";
import { buildWhatsAppInvitationUrl } from "./registration-contact-links";

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
const OCCUPATION_LABELS: Record<string, string> = {
  distributor: "Distribuidor/a",
  manufacturer: "Fabricante",
  architect: "Arquitecto/a",
  decorator: "Decorador/a",
  "installer-technician": "Instalador/a o técnico/a",
};
const initialResendState: ResendInvitationState = {};

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

// Admin feedback round: "prefiero... abrir un side panel al presionar la fila" — every field the
// table's columns couldn't fit (phone/company/job title per attendee, backup code, check-in
// timestamp, full UTM set, source) without the table itself going unreadably wide.
export function RegistrationDetailSheet({
  registration,
  statusLabel,
  open,
  onOpenChange,
  eventId,
  eventName,
  collectCompany,
  collectJobTitle,
}: {
  registration: RegistrationWithAttendees;
  statusLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
}) {
  const [resendState, resendAction, resendPending] = useActionState(resendInvitationAction, initialResendState);
  const utmEntries = (Object.keys(UTM_LABELS) as (keyof typeof UTM_LABELS)[])
    .map((key) => [UTM_LABELS[key], registration[key as keyof RegistrationWithAttendees]] as const)
    .filter(([, value]) => Boolean(value));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-none overflow-y-auto sm:w-[760px] sm:max-w-[760px]">
        <SheetHeader>
          <SheetTitle className="pr-8 text-xl font-semibold tracking-tight">{registration.attendees[0]?.fullName ?? "Registro"}</SheetTitle>
          <SheetDescription className="text-xs">
            {statusLabel} · {registration.createdAt.toLocaleString()} · {registration.source === "admin_added" ? "Agregado por admin" : "Público"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4 text-sm">
          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Contacto</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Correo</p>
                <a href={`mailto:${registration.attendees[0]?.email ?? ""}`} className="break-all text-sm font-medium underline underline-offset-2">
                  {registration.attendees[0]?.email ?? "—"}
                </a>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Teléfono</p>
                <p className="text-sm font-medium">{registration.attendees[0]?.phone ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Empresa</p>
                <p className="text-sm font-medium">{registration.attendees[0]?.company ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Puesto</p>
                <p className="text-sm font-medium">{registration.attendees[0]?.jobTitle ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-3 sm:col-span-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Actividad profesional</p>
                <p className="text-sm font-medium">{OCCUPATION_LABELS[registration.attendees[0]?.occupation ?? ""] ?? registration.attendees[0]?.occupation ?? "—"}</p>
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
                  date={registration.consents?.privacyAcceptedAt ? new Date(registration.consents.privacyAcceptedAt).toLocaleString() : undefined}
                />
                <ConsentStatus
                  label="Términos y condiciones"
                  accepted={Boolean(registration.consents?.termsAcceptedAt)}
                  date={registration.consents?.termsAcceptedAt ? new Date(registration.consents.termsAcceptedAt).toLocaleString() : undefined}
                />
                <ConsentStatus
                  label="Envío de publicidad"
                  accepted={Boolean(registration.consents?.marketingAcceptedAt)}
                  date={registration.consents?.marketingAcceptedAt ? new Date(registration.consents.marketingAcceptedAt).toLocaleString() : undefined}
                />
              </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Asistentes ({registration.attendees.length})
            </h3>
            {registration.attendees.map((attendee) => (
              <div key={attendee.id} className={`flex flex-col gap-2 rounded-lg border p-4 ${attendee.checkedInAt ? "border-emerald-500/40 bg-emerald-500/10" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-base font-semibold">{attendee.fullName}</p><p className="text-sm text-muted-foreground">{attendee.email}</p></div>
                  {attendee.checkedInAt ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300"><CheckCircle2 className="size-3.5" /> Dentro</span> : <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> Pendiente</span>}
                </div>
                {attendee.phone ? <p className="text-sm text-muted-foreground">Tel: {attendee.phone}</p> : null}
                {attendee.company ? (
                  <p className="text-muted-foreground">Empresa: {attendee.company}</p>
                ) : null}
                {attendee.jobTitle ? (
                  <p className="text-muted-foreground">Puesto: {attendee.jobTitle}</p>
                ) : null}
                {attendee.occupation ? (
                  <p className="text-muted-foreground">Actividad: {OCCUPATION_LABELS[attendee.occupation] ?? attendee.occupation}</p>
                ) : null}
                <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2"><p className="text-[11px] font-medium uppercase tracking-wide text-primary/80">Folio de acceso</p><p className="mt-1 font-mono text-lg font-bold tracking-wider text-primary">{attendee.backupCode}</p></div>
                <p className={`text-xs font-medium ${attendee.checkedInAt ? "text-emerald-300" : "text-muted-foreground"}`}>
                  {attendee.checkedInAt ? `Check-in: ${attendee.checkedInAt.toLocaleString()}` : "Sin check-in"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {attendee.phone ? (
                    <>
                      <a href={`tel:${attendee.phone}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-card"><Phone className="size-3" /> Llamar</a>
                      <a href={buildWhatsAppInvitationUrl({ phone: attendee.phone, attendeeName: attendee.fullName, eventName, backupCode: attendee.backupCode })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-card"><MessageCircle className="size-3" /> WhatsApp</a>
                    </>
                  ) : null}
                  <form action={resendAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="attendeeId" value={attendee.id} />
                    <button type="submit" disabled={resendPending} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-card"><Mail className="size-3" /> {resendPending ? "Enviando…" : "Reenviar por correo"}</button>
                  </form>
                </div>
              </div>
            ))}
            {resendState.error ? <p className="text-xs text-destructive">{resendState.error}</p> : null}
            {resendState.success ? <p className="text-xs text-muted-foreground">{resendState.success}</p> : null}
          </section>

          {registration.status !== "cancelled" ? (
            <section className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Acciones</h3>
              <AddCompanionRow
                registrationId={registration.id}
                eventId={eventId}
                collectCompany={collectCompany}
                collectJobTitle={collectJobTitle}
              />
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
