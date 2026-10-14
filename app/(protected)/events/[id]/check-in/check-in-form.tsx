"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { lookupCheckInAction, confirmCheckInAction } from "./actions";
import type { CheckInLookupResult } from "@/modules/events";
import { QrScanner } from "./qr-scanner";
import { ManualFolioDialog } from "./manual-folio-dialog";
import { CheckInResultDialog } from "./check-in-result-dialog";

export function CheckInForm({ eventId, confirmationRequired }: { eventId: string; confirmationRequired: boolean }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [result, setResult] = useState<CheckInLookupResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function lookup(code: string) {
    setPending(true);
    setError(undefined);
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("code", code);
    const response = await lookupCheckInAction(formData);
    setPending(false);
    if (!response.ok) { setError(response.error); return; }
    setResult(response.result);
    setResultOpen(true);
    setManualOpen(false);
    setScannerOpen(false);
    if (!response.confirmationRequired && response.result.kind === "eligible") await confirm(response.result.attendee.id);
  }

  async function confirm(attendeeId: string) {
    setPending(true);
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("attendeeId", attendeeId);
    const response = await confirmCheckInAction(formData);
    setPending(false);
    if (response.error) { setError(response.error); return; }
    setResultOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        {scannerOpen ? <QrScanner active onDetected={lookup} onError={(message) => { setError(message); setScannerOpen(false); }} /> : <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">La cámara está inactiva</div>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1" onClick={() => { setError(undefined); setScannerOpen(true); }} disabled={scannerOpen || pending}>{scannerOpen ? "Escaneando…" : "Escanear QR"}</Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => setManualOpen(true)} disabled={pending}>Registrar acceso con código</Button>
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <ManualFolioDialog open={manualOpen} onOpenChange={setManualOpen} pending={pending} onSubmit={lookup} />
      <CheckInResultDialog result={result} open={resultOpen} confirmationRequired={confirmationRequired} confirming={pending} onOpenChange={setResultOpen} onConfirm={confirm} onConfirmCompanion={confirm} />
    </div>
  );
}
