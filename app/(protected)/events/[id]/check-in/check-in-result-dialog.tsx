"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Ban, Building2, CheckCircle2, Info, Mail, Phone, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckInLookupResult } from "@/modules/events";

export const categoryPresentation = {
  distributor: { label: "Distribuidor/a", className: "bg-orange-500 text-orange-950", surfaceClassName: "border-orange-500/40 bg-orange-500/10" },
  manufacturer: { label: "Fabricante", className: "bg-blue-500 text-blue-950", surfaceClassName: "border-blue-500/40 bg-blue-500/10" },
  architect: { label: "Arquitecto/a", className: "bg-green-500 text-green-950", surfaceClassName: "border-green-500/40 bg-green-500/10" },
  decorator: { label: "Decorador/a", className: "bg-yellow-400 text-yellow-950", surfaceClassName: "border-yellow-400/40 bg-yellow-400/10" },
  "installer-technician": { label: "Instalador/a o técnico/a", className: "bg-red-500 text-red-950", surfaceClassName: "border-red-500/40 bg-red-500/10" },
  unknown: { label: "Categoría no especificada", className: "bg-muted text-muted-foreground", surfaceClassName: "border-border bg-muted/30" },
} as const;

export const statusPresentation = {
  eligible: { label: "Acceso correcto", iconLabel: "Acceso correcto", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
  already_checked_in: { label: "Ya registró entrada", iconLabel: "Información", className: "border-amber-500/40 bg-amber-500/10 text-amber-100" },
  cancelled: { label: "Registro cancelado", iconLabel: "Acceso bloqueado", className: "border-red-500/40 bg-red-500/10 text-red-200" },
  waitlisted: { label: "Lista de espera", iconLabel: "Acceso bloqueado", className: "border-red-500/40 bg-red-500/10 text-red-200" },
  not_found: { label: "No encontrado", iconLabel: "Acceso bloqueado", className: "border-red-500/40 bg-red-500/10 text-red-200" },
} as const;

export const resultDialogPopupClassName =
  "fixed inset-0 z-50 m-auto flex min-h-[100dvh] w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto border border-border bg-popover pt-[calc(1.25rem+env(safe-area-inset-top))] pr-[calc(1.25rem+env(safe-area-inset-right))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] pl-[calc(1.25rem+env(safe-area-inset-left))] text-popover-foreground shadow-2xl lg:h-fit lg:max-h-[calc(100dvh-2rem)] lg:min-h-0 lg:w-[calc(100%-2rem)] lg:max-w-2xl lg:overflow-y-auto lg:rounded-2xl lg:p-7";

type CheckInResultDialogProps = {
  result: CheckInLookupResult | null;
  open: boolean;
  confirmationRequired: boolean;
  confirming: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (attendeeId: string) => void;
  onConfirmCompanion: (attendeeId: string) => void;
};

type CardProps = Omit<CheckInResultDialogProps, "open" | "result"> & { result: Exclude<CheckInLookupResult, { kind: "not_found" }> };

function StatusIcon({ kind }: { kind: keyof typeof statusPresentation }) {
  const Icon = kind === "eligible" ? CheckCircle2 : kind === "already_checked_in" ? Info : Ban;
  return <Icon className="size-5 shrink-0" aria-hidden="true" />;
}

function getStatus(result: CardProps["result"]) {
  if (result.kind === "eligible") return statusPresentation.eligible;
  if (result.kind === "already_checked_in") return statusPresentation.already_checked_in;
  return result.reason === "cancelled" ? statusPresentation.cancelled : statusPresentation.waitlisted;
}

export function NotFoundResultCard({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const status = statusPresentation.not_found;

  return <>
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${status.className}`} role="status">
      <StatusIcon kind="not_found" />
      <span>{status.label}</span>
    </div>
    <DialogPrimitive.Title className="mt-5 text-2xl font-semibold tracking-tight">{status.label}</DialogPrimitive.Title>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">No encontramos un asistente con ese folio en este evento.</p>
    <Button className="mt-8 w-full" onClick={() => onOpenChange(false)}>Cerrar</Button>
  </>;
}

export function CheckInResultCard({ result, confirmationRequired, confirming, error, onOpenChange, onConfirm, onConfirmCompanion }: CardProps) {
  const status = getStatus(result);
  const { attendee, registration } = result;
  const category = categoryPresentation[attendee.occupation as keyof typeof categoryPresentation] ?? categoryPresentation.unknown;
  const companions = registration.attendees.filter((candidate) => candidate.id !== attendee.id);

  return <>
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${status.className}`} role="status">
      <StatusIcon kind={result.kind === "blocked" ? (result.reason === "cancelled" ? "cancelled" : "waitlisted") : result.kind} />
      <span>{status.label}</span>
    </div>
    <DialogPrimitive.Title className="mt-5 min-w-0 break-all [overflow-wrap:anywhere] text-2xl font-semibold tracking-tight">{attendee.fullName}</DialogPrimitive.Title>
    <p className="mt-1 text-sm text-muted-foreground">{status.label}</p>

    <dl className={`mt-6 grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2 ${category.surfaceClassName}`}>
      <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teléfono</dt><dd className="mt-1 flex min-w-0 items-center gap-2 break-all [overflow-wrap:anywhere]"><Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{attendee.phone || "No disponible"}</dd></div>
      <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</dt><dd className="mt-1 flex min-w-0 items-center gap-2 break-all [overflow-wrap:anywhere]"><Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{attendee.company || "No disponible"}</dd></div>
      <div className="min-w-0 sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</dt><dd className="mt-1 flex min-w-0 items-center gap-2 break-all [overflow-wrap:anywhere]"><Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{attendee.email}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoría</dt><dd className="mt-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${category.className}`}><Tag className="size-3.5" aria-hidden="true" />{category.label}</span></dd></div>
    </dl>

    {companions.length > 0 ? <section className="mt-4 rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acompañantes</h3>
      <div className="mt-2 divide-y divide-border">{companions.map((companion) => <div key={companion.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <span className="min-w-0 flex-1 break-all [overflow-wrap:anywhere]">{companion.fullName}</span>
        {companion.checkedInAt ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400"><CheckCircle2 className="size-3.5" aria-hidden="true" />Dentro</span> : <Button type="button" size="sm" variant="outline" onClick={() => onConfirmCompanion(companion.id)}>Registrar entrada</Button>}
      </div>)}</div>
    </section> : null}

    {error ? <div role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{error}</p><p className="mt-1">Podés reintentar la confirmación.</p></div> : null}

    <div className="mt-8 grid gap-2 sm:grid-cols-2">
      {result.kind === "eligible" && confirmationRequired ? <Button disabled={confirming} onClick={() => onConfirm(attendee.id)}>{confirming ? "Registrando…" : "Confirmar entrada"}</Button> : null}
      <Button type="button" variant={result.kind === "eligible" && confirmationRequired ? "outline" : "default"} onClick={() => onOpenChange(false)}>Cerrar</Button>
    </div>
  </>;
}

export function CheckInResultDialog({ result, open, confirmationRequired, confirming, error, onOpenChange, onConfirm, onConfirmCompanion }: CheckInResultDialogProps) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    {open ? <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70" />
      <DialogPrimitive.Popup className={resultDialogPopupClassName}>
        {result?.kind === "not_found" || !result ? <NotFoundResultCard onOpenChange={onOpenChange} /> : <CheckInResultCard result={result} confirmationRequired={confirmationRequired} confirming={confirming} error={error} onOpenChange={onOpenChange} onConfirm={onConfirm} onConfirmCompanion={onConfirmCompanion} />}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal> : null}
  </DialogPrimitive.Root>;
}
