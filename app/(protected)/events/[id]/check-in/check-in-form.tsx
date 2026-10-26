"use client";

import { useEffect, useReducer, useRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { lookupCheckInAction, confirmCheckInAction } from "./actions";
import type { CheckInLookupResult } from "@/modules/events";
import { QrScanner, useScannerCoordinator } from "./qr-scanner";
import { ManualFolioDialog } from "./manual-folio-dialog";
import { CheckInResultDialog } from "./check-in-result-dialog";

type CheckInMode = "idle" | "scanner" | "manual";

export type CheckInState = {
  mode: CheckInMode;
  result: CheckInLookupResult | null;
  resultOpen: boolean;
  pending: boolean;
  captureAttempt: number;
  error?: string;
};

type CheckInStateAction =
  | { type: "open-scanner" }
  | { type: "open-manual" }
  | { type: "capture-closed" }
  | { type: "lookup-started" }
  | { type: "lookup-succeeded"; result: CheckInLookupResult }
  | { type: "lookup-failed"; error: string }
  | { type: "capture-failed"; error: string }
  | { type: "retry-capture" }
  | { type: "confirmation-started" }
  | { type: "confirmation-succeeded" }
  | { type: "confirmation-failed"; error: string }
  | { type: "close-result" };

export const checkInState: CheckInState = {
  mode: "idle",
  result: null,
  resultOpen: false,
  pending: false,
  captureAttempt: 0,
};

export const scannerCaptureClassName =
  "fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-background pt-[calc(1rem+env(safe-area-inset-top))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] sm:pt-[calc(1.5rem+env(safe-area-inset-top))] sm:pr-[calc(1.5rem+env(safe-area-inset-right))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pl-[calc(1.5rem+env(safe-area-inset-left))]";

export function transitionCheckInState(state: CheckInState, action: CheckInStateAction): CheckInState {
  switch (action.type) {
    case "open-scanner":
      return { ...state, mode: "scanner", error: undefined, captureAttempt: state.captureAttempt + 1 };
    case "open-manual":
      return { ...state, mode: "manual", error: undefined };
    case "capture-closed":
      return { ...state, mode: "idle" };
    case "lookup-started":
      return { ...state, pending: true, error: undefined };
    case "lookup-succeeded":
      return { ...state, mode: "idle", result: action.result, resultOpen: true, pending: false, error: undefined };
    case "lookup-failed":
      return { ...state, pending: false, error: action.error };
    case "capture-failed":
      return { ...state, mode: "scanner", pending: false, error: action.error };
    case "retry-capture":
      return { ...state, mode: "scanner", pending: false, error: undefined, captureAttempt: state.captureAttempt + 1 };
    case "confirmation-started":
      return { ...state, pending: true };
    case "confirmation-succeeded":
      return { ...state, pending: false, resultOpen: true };
    case "confirmation-failed":
      return { ...state, pending: false, error: action.error };
    case "close-result":
      return { ...state, mode: "idle", resultOpen: false };
  }
}

export function CheckInForm({ eventId, confirmationRequired }: { eventId: string; confirmationRequired: boolean }) {
  const [state, dispatch] = useReducer(transitionCheckInState, checkInState);
  const scannerCoordinator = useScannerCoordinator();
  const scannerTriggerRef = useRef<HTMLButtonElement>(null);
  const scannerCancelRef = useRef<HTMLButtonElement>(null);
  const previousModeRef = useRef(state.mode);

  useEffect(() => {
    const previousMode = previousModeRef.current;
    if (state.mode === "scanner") scannerCancelRef.current?.focus();
    if (previousMode === "scanner" && state.mode !== "scanner") scannerTriggerRef.current?.focus();
    previousModeRef.current = state.mode;
  }, [state.mode]);

  useEffect(() => {
    if (state.mode === "scanner" && scannerCoordinator.activeOwner && scannerCoordinator.activeOwner !== "check-in") {
      dispatch({ type: "capture-closed" });
    }
  }, [scannerCoordinator.activeOwner, state.mode]);

  async function lookup(code: string) {
    dispatch({ type: "lookup-started" });
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("code", code);
    const response = await lookupCheckInAction(formData);
    if (!response.ok) { dispatch({ type: "lookup-failed", error: response.error }); return; }
    dispatch({ type: "lookup-succeeded", result: response.result });
    if (!response.confirmationRequired && response.result.kind === "eligible") await confirm(response.result.attendee.id);
  }

  async function confirm(attendeeId: string, closeResultOnSuccess = false) {
    dispatch({ type: "confirmation-started" });
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("attendeeId", attendeeId);
    const response = await confirmCheckInAction(formData);
    if (response.error) { dispatch({ type: "confirmation-failed", error: response.error }); return; }
    dispatch({ type: "confirmation-succeeded" });
    if (closeResultOnSuccess) dispatch({ type: "close-result" });
  }

  function openScanner() {
    scannerCoordinator.claim("check-in");
    dispatch({ type: "open-scanner" });
  }

  function openManual() {
    dispatch({ type: "open-manual" });
  }

  function closeCapture() {
    scannerCoordinator.release("check-in");
    dispatch({ type: "capture-closed" });
  }

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-7">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Check-in operativo</p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-5xl">Validar acceso</h1>
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
          Escaneá el pase o ingresá el código. El resultado quedará visible hasta que el host decida continuar.
        </p>
        <div className="mt-8 grid gap-3 sm:flex">
          <Button ref={scannerTriggerRef} type="button" onClick={openScanner} disabled={state.pending} className="min-h-12 flex-1 sm:flex-none">
            Escanear QR
          </Button>
          <Button type="button" variant="outline" onClick={openManual} disabled={state.pending} className="min-h-12 flex-1 sm:flex-none">
            Ingresar código
          </Button>
        </div>
        {state.error && state.mode === "idle" && !state.resultOpen ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p> : null}
      </div>
      <DialogPrimitive.Root open={state.mode === "scanner"} onOpenChange={(open) => { if (!open) closeCapture(); }}>
        {state.mode === "scanner" ? (
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70" />
            <DialogPrimitive.Popup
              className={scannerCaptureClassName}
              initialFocus={scannerCancelRef}
              finalFocus={scannerTriggerRef}
            >
              <header className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cámara activa</p>
                  <DialogPrimitive.Title className="mt-2 text-xl font-semibold">Apuntá al QR</DialogPrimitive.Title>
                </div>
                <Button ref={scannerCancelRef} type="button" variant="ghost" onClick={closeCapture}>Cancelar</Button>
              </header>
              <div className="flex min-h-0 flex-1 items-center justify-center py-8">
                <div className="flex w-full max-w-xl flex-col items-center gap-4">
                  <QrScanner key={state.captureAttempt} active={!state.pending} onDetected={(code) => { void lookup(code); }} onError={(message) => dispatch({ type: "capture-failed", error: message })} />
                  {state.error ? <div role="alert" className="w-full rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{state.error}</p><p className="mt-1">Podés reintentar el escaneo.</p><Button type="button" variant="outline" className="mt-3" onClick={() => dispatch({ type: "retry-capture" })}>Reintentar escaneo</Button></div> : null}
                </div>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        ) : null}
      </DialogPrimitive.Root>
      <ManualFolioDialog open={state.mode === "manual"} onOpenChange={(open) => { if (!open) closeCapture(); }} pending={state.pending} error={state.error} onSubmit={lookup} />
      <CheckInResultDialog result={state.result} open={state.resultOpen} confirmationRequired={confirmationRequired} confirming={state.pending} error={state.error} onOpenChange={(open) => { if (!open) dispatch({ type: "close-result" }); }} onConfirm={(attendeeId) => { void confirm(attendeeId, true); }} onConfirmCompanion={confirm} />
    </section>
  );
}
