"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";

export type AddedCompanion = {
  fullName: string;
  backupCode: string;
};

export function CompanionAddedDialog({
  open,
  onOpenChange,
  companion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companion: AddedCompanion | null;
}) {
  if (!companion) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60" />
          <DialogPrimitive.Popup className="fixed inset-0 z-50 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-xl border border-emerald-500/40 bg-popover p-6 text-popover-foreground shadow-2xl">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200" role="status">
              Acompañante agregado exitosamente
            </div>
            <DialogPrimitive.Title className="mt-4 text-base font-semibold">{companion.fullName}</DialogPrimitive.Title>
            <p className="mt-1 text-sm text-muted-foreground">Guardá este folio para identificar su acceso.</p>
            <p className="mt-4 select-all rounded-lg border border-border bg-background px-4 py-3 text-center font-mono text-xl font-semibold tracking-[0.18em]">
              {companion.backupCode}
            </p>
            <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>Listo</Button>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}
