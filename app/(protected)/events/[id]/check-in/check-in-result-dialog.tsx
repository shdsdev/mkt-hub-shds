"use client";

import { useEffect, useRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Ban, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckInLookupResult } from "@/modules/events";

export const categoryPresentation = {
  distributor: { label: "Distribuidor", className: "bg-orange-600 text-white", surfaceClassName: "border-orange-500/40 bg-orange-500/10" },
  manufacturer: { label: "Fabricante", className: "bg-blue-600 text-white", surfaceClassName: "border-blue-500/40 bg-blue-500/10" },
  architect: { label: "Arquitecto", className: "bg-green-600 text-white", surfaceClassName: "border-green-500/40 bg-green-500/10" },
  decorator: { label: "Decorador", className: "bg-yellow-700 text-white", surfaceClassName: "border-yellow-400/40 bg-yellow-400/10" },
  "installer-technician": { label: "Instalador o técnico", className: "bg-red-600 text-white", surfaceClassName: "border-red-500/40 bg-red-500/10" },
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

function PassQr({ value }: { value: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled || !container) return;
      const qr = new QRCodeStyling({
        width: 176,
        height: 176,
        type: "svg",
        data: value,
        qrOptions: { errorCorrectionLevel: "M" },
        dotsOptions: { type: "square", color: "#111111" },
        cornersSquareOptions: { type: "square", color: "#111111" },
        cornersDotOptions: { type: "square", color: "#111111" },
        backgroundOptions: { color: "#ffffff" },
      });
      qr.append(container);
    });

    return () => {
      cancelled = true;
      container?.replaceChildren();
    };
  }, [value]);

  return <div ref={containerRef} className="flex min-h-48 min-w-48 items-center justify-center" aria-label="Código QR del pase" />;
}

function DigitalPass({ attendee, category }: { attendee: CardProps["result"]["attendee"]; category: (typeof categoryPresentation)[keyof typeof categoryPresentation] }) {
  return (
    <section className={`relative mt-5 overflow-hidden rounded-[1.25rem] p-5 shadow-xl sm:p-7 ${category.className}`} aria-label="Pase digital del asistente">
      <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/35 pb-5">
        <div>
          <p className="font-heading text-2xl font-black uppercase leading-none tracking-tight">Shades</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/80">Pase digital</p>
        </div>
        <div className="text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
          <p>Check-in</p>
          <p className="mt-1 text-white">Acceso autorizado</p>
        </div>
      </div>

      <div className="relative z-10 mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">Asistente</p>
          <h3 className="mt-1 break-words text-3xl font-black uppercase leading-[0.95] tracking-tight sm:text-4xl">{attendee.fullName}</h3>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">Teléfono</p><p className="mt-1 break-all font-medium">{attendee.phone || "No disponible"}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">Empresa</p><p className="mt-1 break-words font-medium">{attendee.company || "No disponible"}</p></div>
            <div className="sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">Email</p><p className="mt-1 break-all font-medium">{attendee.email}</p></div>
          </div>
        </div>
        <div className="w-fit rounded-xl bg-white p-2 text-black shadow-lg">
          <PassQr value={attendee.passToken} />
          <p className="px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide">Escaneá para validar</p>
        </div>
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/35 pt-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">Categoría</p><p className="mt-1 text-sm font-bold">{category.label}</p></div>
        <div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">Folio</p><p className="mt-1 font-mono text-lg font-bold tracking-[0.16em]">{attendee.backupCode}</p></div>
      </div>
    </section>
  );
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
    <DialogPrimitive.Title className="sr-only">{attendee.fullName}</DialogPrimitive.Title>
    <p className="sr-only">{status.label}</p>

    <DigitalPass attendee={attendee} category={category} />

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
