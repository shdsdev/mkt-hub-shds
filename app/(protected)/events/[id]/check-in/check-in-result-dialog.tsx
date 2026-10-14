"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import type { CheckInLookupResult } from "@/modules/events";

export function CheckInResultDialog({ result, open, confirmationRequired, confirming, onOpenChange, onConfirm, onConfirmCompanion }: { result: CheckInLookupResult | null; open: boolean; confirmationRequired: boolean; confirming: boolean; onOpenChange: (open: boolean) => void; onConfirm: (attendeeId: string) => void; onConfirmCompanion: (attendeeId: string) => void }) {
  if (!result || result.kind === "not_found") {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        {open ? <DialogPrimitive.Portal><DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60" /><DialogPrimitive.Popup className="fixed inset-0 z-50 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl"><DialogPrimitive.Title className="text-base font-semibold">No encontrado</DialogPrimitive.Title><p className="mt-2 text-sm text-muted-foreground">No encontramos un asistente con ese folio en este evento.</p><Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogPrimitive.Popup></DialogPrimitive.Portal> : null}
      </DialogPrimitive.Root>
    );
  }

  const { attendee, registration } = result;
  const title = result.kind === "already_checked_in" ? "Ya ingresó" : result.kind === "blocked" ? (result.reason === "cancelled" ? "Registro cancelado" : "Lista de espera") : "Acreditado";
  const canConfirm = result.kind === "eligible";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {open ? <DialogPrimitive.Portal><DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60" /><DialogPrimitive.Popup className="fixed inset-0 z-50 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl"><DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title><div className="mt-4 flex flex-col gap-3 text-sm"><div className="rounded-lg border border-border p-4"><p className="text-lg font-semibold">{attendee.fullName}</p><p className="text-muted-foreground">{attendee.email}</p><p className="mt-2 font-mono font-semibold">{attendee.backupCode}</p>{attendee.checkedInAt ? <p className="mt-2 text-xs text-muted-foreground">Ya ingresó anteriormente.</p> : null}</div><div className="rounded-lg border border-border p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acompañantes</p>{registration.attendees.filter((candidate) => candidate.id !== attendee.id).map((companion) => <div key={companion.id} className="flex items-center justify-between gap-3 border-t border-border py-2"><span>{companion.fullName}</span>{companion.checkedInAt ? <span className="text-xs text-emerald-400">Dentro</span> : <Button type="button" size="sm" variant="outline" onClick={() => onConfirmCompanion(companion.id)}>Registrar entrada</Button>}</div>)}</div></div>{canConfirm && confirmationRequired ? <Button className="mt-5 w-full" disabled={confirming} onClick={() => onConfirm(attendee.id)}>{confirming ? "Registrando…" : "Confirmar entrada"}</Button> : <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>Cerrar</Button>}</DialogPrimitive.Popup></DialogPrimitive.Portal> : null}
    </DialogPrimitive.Root>
  );
}
