"use client";

import { useActionState, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import type { BenefitLookupResult, BenefitRedemptionHistoryRow, BenefitRow } from "@/modules/events";
import { listBenefitRedemptionsAction, lookupBenefitRedemptionAction, redeemBenefitAction } from "./actions";
import type { CheckInFormState } from "./actions";
import { annulBenefitRedemptionAction, type BenefitActionState } from "../benefits/actions";
import { ManualFolioDialog } from "./manual-folio-dialog";
import { QrScanner, useScannerCoordinator } from "./qr-scanner";

type BenefitWithAvailability = BenefitRow & { remaining?: number | null };
type BenefitMode = "idle" | "scanner" | "manual";

export type BenefitRedemptionState = {
  mode: BenefitMode;
  lookup: Extract<BenefitLookupResult, { ok: true }> | null;
  selectedBenefitId: string | null;
  pending: boolean;
  success: boolean;
  redemptionDetails?: NonNullable<CheckInFormState["redemption"]>;
  statusText?: string;
  error?: string;
  captureAttempt: number;
};

type BenefitAction =
  | { type: "open-scanner" }
  | { type: "open-manual" }
  | { type: "capture-closed" }
  | { type: "lookup-started" }
  | { type: "lookup-succeeded"; result: Extract<BenefitLookupResult, { ok: true }> }
  | { type: "lookup-failed"; error: string }
  | { type: "select-benefit"; benefitId: string }
  | { type: "redeem-started" }
  | { type: "redeem-succeeded"; result?: Extract<BenefitLookupResult, { ok: true }>; redemption?: NonNullable<CheckInFormState["redemption"]> }
  | { type: "redeem-failed"; error: string }
  | { type: "retry-capture" };

export const benefitRedemptionState: BenefitRedemptionState = {
  mode: "idle",
  lookup: null,
  selectedBenefitId: null,
  pending: false,
  success: false,
  captureAttempt: 0,
};

export function transitionBenefitRedemptionState(state: BenefitRedemptionState, action: BenefitAction): BenefitRedemptionState {
  switch (action.type) {
    case "open-scanner": return { ...state, mode: "scanner", error: undefined, captureAttempt: state.captureAttempt + 1 };
    case "open-manual": return { ...state, mode: "manual", error: undefined };
    case "capture-closed": return { ...state, mode: "idle" };
    case "lookup-started": return { ...state, pending: true, error: undefined, success: false };
    case "lookup-succeeded": {
      const missingCheckIn = !action.result.attendee.checkedInAt;
      return { ...state, mode: "idle", lookup: action.result, pending: false, selectedBenefitId: null, error: missingCheckIn ? "Primero debe realizar el check-in." : undefined, statusText: action.result.redemption ? action.result.event.benefitRedemptionScope === "registration" ? "Beneficio ya canjeado por este registro" : "Beneficio ya canjeado" : undefined };
    }
    case "lookup-failed": return { ...state, pending: false, error: action.error };
    case "select-benefit": return { ...state, selectedBenefitId: action.benefitId, error: undefined };
    case "redeem-started": return { ...state, pending: true, error: undefined };
    case "redeem-succeeded": return { ...state, pending: false, success: true, lookup: action.result ?? state.lookup, redemptionDetails: action.redemption, statusText: undefined };
    case "redeem-failed": return { ...state, pending: false, error: action.error };
    case "retry-capture": return { ...state, mode: "scanner", pending: false, error: undefined, captureAttempt: state.captureAttempt + 1 };
  }
}

function benefitLabel(benefit: BenefitWithAvailability) {
  return benefit.kind === "gift" ? benefit.name : `${benefit.percentage}% de descuento`;
}

export function redeemedBenefitLabel(benefit?: Pick<BenefitWithAvailability, "kind" | "name" | "percentage">) {
  return benefit?.name ?? (benefit?.kind === "discount" && benefit.percentage !== null && benefit.percentage !== undefined ? `${benefit.percentage}% de descuento` : "Beneficio registrado");
}

function remainingLabel(benefit: BenefitWithAvailability) {
  return benefit.remaining === null || benefit.remaining === undefined ? "Disponibles: sin límite" : `Disponibles: ${benefit.remaining}`;
}

export function BenefitRedemptionForm({ eventId, initialLookup, history, canAnnulHistory }: { eventId: string; initialLookup?: Extract<BenefitLookupResult, { ok: true }>; history: BenefitRedemptionHistoryRow[]; canAnnulHistory: boolean }) {
  const [state, dispatch] = useReducer(transitionBenefitRedemptionState, { ...benefitRedemptionState, lookup: initialLookup ?? null });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState(history);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>();
  const [annulmentId, setAnnulmentId] = useState<string | null>(null);
  const [annulState, annulAction, annulPending] = useActionState(async (_state: BenefitActionState, formData: FormData) => annulBenefitRedemptionAction(formData), {});
  const scannerCoordinator = useScannerCoordinator();
  const scannerTriggerRef = useRef<HTMLButtonElement>(null);
  const scannerCancelRef = useRef<HTMLButtonElement>(null);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);
  const historyCloseRef = useRef<HTMLButtonElement>(null);
  const previousModeRef = useRef(state.mode);

  useEffect(() => {
    if (state.mode === "scanner") scannerCancelRef.current?.focus();
    if (previousModeRef.current === "scanner" && state.mode !== "scanner") scannerTriggerRef.current?.focus();
    previousModeRef.current = state.mode;
  }, [state.mode]);

  useEffect(() => {
    if (state.mode === "scanner" && scannerCoordinator.activeOwner && scannerCoordinator.activeOwner !== "benefit") dispatch({ type: "capture-closed" });
  }, [scannerCoordinator.activeOwner, state.mode]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(undefined);
    const formData = new FormData();
    formData.set("eventId", eventId);
    const response = await listBenefitRedemptionsAction(formData);
    if (response.ok) setHistoryRows(response.history);
    else setHistoryError(response.error);
    setHistoryLoading(false);
  }, [eventId]);

  useEffect(() => {
    if (annulState.success) void refreshHistory();
  }, [annulState.success, refreshHistory]);

  async function lookup(code: string) {
    dispatch({ type: "lookup-started" });
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("code", code);
    const response = await lookupBenefitRedemptionAction(formData);
    if (response.ok !== true) { dispatch({ type: "lookup-failed", error: response.error }); return; }
    dispatch({ type: "lookup-succeeded", result: response.result as Extract<BenefitLookupResult, { ok: true }> });
  }

  async function redeem() {
    if (!state.lookup || !state.selectedBenefitId || !state.lookup.attendee.checkedInAt || state.lookup.redemption) return;
    dispatch({ type: "redeem-started" });
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("code", state.lookup.attendee.backupCode);
    formData.set("benefitId", state.selectedBenefitId);
    const response = await redeemBenefitAction(formData);
    if (response.error) { dispatch({ type: "redeem-failed", error: response.error }); return; }
    dispatch({ type: "redeem-succeeded", redemption: response.redemption });
    await refreshHistory();
  }

  function closeCapture() {
    scannerCoordinator.release("benefit");
    dispatch({ type: "capture-closed" });
  }

  const benefits = (state.lookup?.benefits ?? []) as BenefitWithAvailability[];
  const scopeConfigured = Boolean(state.lookup?.event.benefitRedemptionScope);
  const canRedeem = Boolean(scopeConfigured && state.lookup?.attendee.checkedInAt && !state.lookup.redemption && state.selectedBenefitId && !state.pending);

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-7">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Beneficios operativos</p>
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-5xl">Validar beneficio</h2>
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">Escaneá el pase o ingresá el código para consultar y registrar un beneficio.</p>
        <div className="mt-8 grid gap-3 sm:flex">
          <Button ref={scannerTriggerRef} type="button" onClick={() => { scannerCoordinator.claim("benefit"); dispatch({ type: "open-scanner" }); }} disabled={state.pending} className="min-h-12 flex-1 sm:flex-none">Escanear QR</Button>
          <Button type="button" variant="outline" onClick={() => dispatch({ type: "open-manual" })} disabled={state.pending} className="min-h-12 flex-1 sm:flex-none">Ingresar código</Button>
          <Button ref={historyTriggerRef} type="button" variant="ghost" aria-label="Ver historial de canjes" onClick={() => { setHistoryOpen(true); void refreshHistory(); }} disabled={state.pending} className="min-h-12 flex-1 sm:flex-none">Ver historial</Button>
        </div>
        {state.error && state.mode === "idle" ? <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p> : null}
        {state.lookup ? <div className="mt-6 space-y-4" aria-live="polite">
          <div className="rounded-xl border border-border p-4 text-sm"><p className="font-semibold">{state.lookup.attendee.fullName}</p><p className="mt-1 text-muted-foreground">{state.lookup.attendee.checkedInAt ? "Check-in confirmado" : "Primero debe realizar el check-in."}</p></div>
          {!scopeConfigured ? <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-semibold">Configura el alcance del canje en el editor de beneficios antes de continuar.</p> : null}
          {state.statusText ? <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-semibold">{state.statusText}</p> : null}
          {state.success ? <div role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm"><p className="font-semibold">Beneficio canjeado correctamente.</p><p className="mt-1 text-muted-foreground">Beneficio: {redeemedBenefitLabel(benefits.find((benefit) => benefit.id === state.redemptionDetails?.benefitId))}</p><p className="text-muted-foreground">Fecha y hora: {state.redemptionDetails ? new Date(state.redemptionDetails.createdAt).toLocaleString("es-MX") : "Registrado"}</p><p className="text-muted-foreground">Responsable: {state.redemptionDetails?.actorName ?? "Operación registrada"}</p></div> : null}
          {scopeConfigured && !state.lookup.redemption && !state.success && state.lookup.attendee.checkedInAt ? <div className="space-y-2"><p className="text-sm font-semibold">Selecciona un beneficio</p>{benefits.length === 0 ? <p className="text-sm text-muted-foreground">No hay beneficios activos configurados.</p> : benefits.map((benefit) => <label key={benefit.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm has-[:checked]:border-ring"><input type="radio" name="benefit" value={benefit.id} checked={state.selectedBenefitId === benefit.id} onChange={() => dispatch({ type: "select-benefit", benefitId: benefit.id })} className="mt-1" /><span><span className="block font-medium">{benefitLabel(benefit)}</span><span className="mt-1 block text-xs text-muted-foreground">{remainingLabel(benefit)}</span></span></label>)}</div> : null}
          {state.lookup.redemption ? <p className="text-sm text-muted-foreground">Beneficio asignado: {state.lookup.redemptionBenefit?.name ?? (state.lookup.redemptionBenefit?.percentage ? `${state.lookup.redemptionBenefit.percentage}% de descuento` : "Beneficio registrado")}. Fecha: {new Date(state.lookup.redemption.createdAt).toLocaleString("es-MX")}</p> : null}
          {!state.lookup.redemption && !state.success ? <Button type="button" className="w-full" disabled={!canRedeem} onClick={() => void redeem()}>{state.pending ? "Registrando…" : "Confirmar canje"}</Button> : null}
        </div> : null}
      </div>
      <DialogPrimitive.Root open={state.mode === "scanner"} onOpenChange={(open) => { if (!open) closeCapture(); }}>
        {state.mode === "scanner" ? <DialogPrimitive.Portal><DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70" /><DialogPrimitive.Popup className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-background p-5 sm:p-8" initialFocus={scannerCancelRef} finalFocus={scannerTriggerRef}><header className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cámara activa</p><DialogPrimitive.Title className="mt-2 text-xl font-semibold">Apuntá al QR</DialogPrimitive.Title></div><Button ref={scannerCancelRef} type="button" variant="ghost" onClick={closeCapture}>Cancelar</Button></header><div className="flex min-h-0 flex-1 items-center justify-center py-8"><div className="w-full max-w-xl"><QrScanner key={state.captureAttempt} active={!state.pending} onDetected={(code) => { void lookup(code); }} onError={(message) => dispatch({ type: "lookup-failed", error: message })} /></div></div></DialogPrimitive.Popup></DialogPrimitive.Portal> : null}
      </DialogPrimitive.Root>
      <DialogPrimitive.Root open={historyOpen} onOpenChange={setHistoryOpen}>
        {historyOpen ? <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-3xl max-h-[80dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-8" initialFocus={historyCloseRef} finalFocus={historyTriggerRef}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogPrimitive.Title className="text-xl font-semibold">Historial de canjes</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">Los canjes anulados se conservan para auditoría.</DialogPrimitive.Description>
              </div>
              <Button ref={historyCloseRef} type="button" variant="ghost" onClick={() => setHistoryOpen(false)}>Cerrar</Button>
            </div>
            <div className="mt-6">
              {historyLoading ? <p role="status" className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Actualizando historial…</p> : historyError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{historyError}</p> : historyRows.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Todavía no hay canjes.</p> : <ol className="overflow-hidden rounded-lg border border-border">
                {historyRows.map((redemption) => <li key={redemption.id} className="flex flex-col gap-3 border-b border-border p-4 last:border-b-0">
                  <div className="text-sm">
                    <p className="font-medium">{redemption.attendeeName}</p>
                    <p className="mt-1">{redemption.benefitName ?? (redemption.benefitKind === "discount" && redemption.benefitPercentage !== null ? `${redemption.benefitPercentage}% de descuento` : "Beneficio")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(redemption.createdAt).toLocaleString("es-MX")} · {redemption.status === "annulled" ? "Anulado" : "Activo"}</p>
                    <p className="text-xs text-muted-foreground">Responsable: {redemption.actorName ?? "No disponible"}</p>
                  </div>
                  {canAnnulHistory && redemption.status === "active" ? <Button type="button" variant="destructive" size="sm" onClick={() => setAnnulmentId(redemption.id)}>Anular</Button> : null}
                </li>)}
              </ol>}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal> : null}
      </DialogPrimitive.Root>
      <DialogPrimitive.Root open={annulmentId !== null} onOpenChange={(open) => { if (!open) setAnnulmentId(null); }}>
        {annulmentId ? <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/50" />
          <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-[70] w-[min(90vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 shadow-xl">
            <DialogPrimitive.Title className="font-semibold">Anular canje</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">Indica por qué debe anularse este canje.</DialogPrimitive.Description>
            <form action={annulAction} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="redemptionId" value={annulmentId} />
              <label className="flex flex-col gap-1.5 text-sm font-medium">Motivo de la anulación<textarea name="reason" required maxLength={1000} rows={4} className="resize-y rounded-lg border border-input bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAnnulmentId(null)}>Cancelar</Button><Button type="submit" variant="destructive" disabled={annulPending}>{annulPending ? "Anulando…" : "Confirmar anulación"}</Button></div>
              {annulState.error ? <p role="alert" className="text-sm text-destructive">{annulState.error}</p> : null}
              {annulState.success ? <p role="status" className="text-sm text-muted-foreground">{annulState.success}</p> : null}
            </form>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal> : null}
      </DialogPrimitive.Root>
      <ManualFolioDialog open={state.mode === "manual"} onOpenChange={(open) => { if (!open) dispatch({ type: "capture-closed" }); }} pending={state.pending} error={state.error} onSubmit={lookup} />
    </section>
  );
}
