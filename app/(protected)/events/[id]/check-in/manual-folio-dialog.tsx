"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";

export function canSubmitManualFolio(code: string, pending: boolean) {
  return !pending && code.length === 8;
}

export const manualFolioErrorGuidance = "Revisá el folio y volvé a intentar.";

export const manualFolioDialogPopupClassName =
  "fixed inset-0 z-50 m-auto flex min-h-[100dvh] w-full flex-col border border-border bg-popover pt-[calc(1.25rem+env(safe-area-inset-top))] pr-[calc(1.25rem+env(safe-area-inset-right))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] pl-[calc(1.25rem+env(safe-area-inset-left))] text-popover-foreground shadow-2xl lg:h-fit lg:min-h-0 lg:w-[calc(100%-2rem)] lg:max-w-md lg:rounded-xl lg:p-6";

export function ManualFolioDialog({ open, onOpenChange, pending, error, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; error?: string; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");

  function close(nextOpen: boolean) {
    if (!nextOpen) setCode("");
    onOpenChange(nextOpen);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      {open ? (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60" />
          <DialogPrimitive.Popup className={manualFolioDialogPopupClassName}>
            <div>
              <DialogPrimitive.Title className="text-base font-semibold">Registrar acceso con código</DialogPrimitive.Title>
              <p className="mt-1 text-sm text-muted-foreground">Escribe el folio de 8 caracteres del pase.</p>
            </div>
            <form className="mt-8 flex flex-1 flex-col gap-4 lg:mt-5 lg:flex-none" onSubmit={(event) => { event.preventDefault(); if (canSubmitManualFolio(code, pending)) onSubmit(code); }}>
              <InputOTP
                autoFocus
                maxLength={8}
                pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                value={code}
                onChange={(value) => setCode(value.toUpperCase())}
                containerClassName="justify-center"
                aria-label="Folio de 8 caracteres"
              >
                <InputOTPGroup>
                  {Array.from({ length: 8 }, (_, index) => <InputOTPSlot key={index} index={index} className="size-10 font-mono text-base uppercase lg:size-11" />)}
                </InputOTPGroup>
              </InputOTP>
              {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{error}</p><p className="mt-1">{manualFolioErrorGuidance}</p></div> : null}
              <div className="mt-auto grid gap-2 lg:mt-0 lg:grid-cols-2">
                <Button type="submit" disabled={!canSubmitManualFolio(code, pending)}>{pending ? "Buscando…" : "Validar código"}</Button>
                <Button type="button" variant="outline" onClick={() => close(false)}>Cancelar</Button>
              </div>
            </form>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}
