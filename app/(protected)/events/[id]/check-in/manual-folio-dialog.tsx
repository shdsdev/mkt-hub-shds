"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ManualFolioDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; onSubmit: (code: string) => void }) {
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
          <DialogPrimitive.Popup className="fixed inset-0 z-50 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl">
            <DialogPrimitive.Title className="text-base font-semibold">Registrar acceso con código</DialogPrimitive.Title>
            <p className="mt-1 text-sm text-muted-foreground">Escribe el folio de 8 caracteres del pase.</p>
            <form className="mt-5 flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit(code); }}>
              <Input
                autoFocus
                value={code}
                maxLength={8}
                placeholder="ABCD1234"
                className="h-12 text-center font-mono text-lg uppercase tracking-[0.25em]"
                onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())}
              />
              <Button type="submit" disabled={pending || code.length !== 8}>{pending ? "Buscando…" : "Buscar asistente"}</Button>
            </form>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}
