"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryPrimaryTransferInvitationAction, transferPrimaryOwnershipAction, type ResendInvitationState, type TransferPrimaryState } from "./actions";

type Props = {
  eventId: string;
  registrationId: string;
  attendee: { id: string; fullName: string; email: string; company?: string | null };
  approved: boolean;
  companions: number;
  onClose: () => void;
  children: ReactNode;
};

export function TransferPrimaryDialog({ eventId, registrationId, attendee, approved, companions, onClose, children }: Props) {
  const [reviewData, setReviewData] = useState<FormData | null>(null);
  const [state, setState] = useState<TransferPrimaryState>({});
  const [retryState, setRetryState] = useState<ResendInvitationState>({});
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (reviewData || state.success) title.current?.focus();
  }, [reviewData, state.success]);

  function close() {
    if (inFlight.current) return;
    onClose();
    if (state.success && state.warning) router.refresh();
  }

  function confirm() {
    if (!reviewData || inFlight.current || state.success) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        const result = await transferPrimaryOwnershipAction({}, reviewData);
        setState(result);
        if (result.success && !result.warning) router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }

  function retry() {
    if (!state.retry || inFlight.current || retryState.success) return;
    const data = new FormData();
    for (const [key, value] of Object.entries(state.retry)) data.set(key, value);
    inFlight.current = true;
    startTransition(async () => {
      try {
        setRetryState(await retryPrimaryTransferInvitationAction({}, data));
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/60" />
        <Dialog.Popup className="fixed inset-0 z-[60] m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl" aria-busy={pending}>
          <button type="button" onClick={close} disabled={pending} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-50" aria-label="Cerrar"><X className="size-4" aria-hidden="true" /></button>
          <Dialog.Title ref={title} tabIndex={-1} className="pr-8 text-base font-semibold outline-none">{state.success ? "Resultado de la transferencia" : reviewData ? "Revisar transferencia" : "Transferir titularidad"}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{state.success ? "La transferencia ya se realizó. No es necesario repetirla." : "Completa los datos y revisa el cambio antes de confirmarlo."}</Dialog.Description>
          <form ref={form} hidden={Boolean(reviewData || state.success)} onSubmit={(event) => { event.preventDefault(); if (inFlight.current || reviewData || state.success) return; const data = new FormData(event.currentTarget); if (!data.get("occupation")) { setState({ error: "Selecciona una actividad profesional." }); return; } setState({}); setReviewData(data); }} className="mt-5">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="registrationId" value={registrationId} />
            <input type="hidden" name="attendeeId" value={attendee.id} />
            <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3">{children}<div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" size="sm" onClick={close}>Cancelar</Button><Button type="submit" size="sm">Revisar transferencia</Button></div></fieldset>
          </form>
          {reviewData && !state.success ? <section className="mt-5 space-y-4"><dl className="space-y-3 text-sm [overflow-wrap:anywhere]"><div><dt className="text-muted-foreground">Titular actual</dt><dd className="font-semibold">{attendee.fullName}</dd><dd>{attendee.email}</dd></div><div><dt className="text-muted-foreground">Nuevo titular</dt><dd className="font-semibold">{String(reviewData.get("fullName"))}</dd><dd>{String(reviewData.get("email"))}</dd></div></dl><p className="text-sm font-medium">El acceso anterior dejará de funcionar. {companions} acompañante{companions === 1 ? "" : "s"} permanecerán sin cambios.</p><p className="text-sm text-muted-foreground">{approved ? "El registro seguirá aprobado y se enviará automáticamente una nueva invitación." : "El registro continuará pendiente de aprobación. No se enviará una invitación hasta que se apruebe."}</p><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => { setReviewData(null); setState({}); requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>('input[name="fullName"]')?.focus()); }}>Volver a editar</Button><Button type="button" size="sm" disabled={pending} onClick={confirm}>{pending ? "Transfiriendo..." : "Sí, transferir titularidad"}</Button></div></section> : null}
          {state.error ? <p role="alert" className="mt-3 text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <div className="mt-5 space-y-4"><p role="status" className="text-sm">{state.success}</p>{state.warning && !retryState.success ? <p role="alert" className="text-sm">{state.warning}</p> : null}{retryState.error ? <p role="alert" className="text-sm text-destructive">{retryState.error}</p> : null}{retryState.success ? <p role="status" className="text-sm">{retryState.success}</p> : null}<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{state.retry && !retryState.success ? <Button type="button" size="sm" disabled={pending} onClick={retry}>{pending ? "Enviando..." : "Reintentar envío de invitación"}</Button> : null}<Button type="button" variant="outline" size="sm" disabled={pending} onClick={close}>Cerrar</Button></div></div> : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
