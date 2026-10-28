"use client";

import { useActionState, useRef, type RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BinaryLoader } from "@/components/binary-loader";
import { deleteQrCodeAction, restoreQrCodeAction, type QrLifecycleState } from "./actions";
import type { QrListRow } from "./qr-list";

export function QrLifecycleDialog({ row, onClose, finalFocus }: { row: QrListRow; onClose: () => void; finalFocus: RefObject<HTMLElement | null> }) {
  const restoring = Boolean(row.deletedAt);
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const [{ error, success }, submit, pending] = useActionState(async (previous: QrLifecycleState, formData: FormData): Promise<QrLifecycleState> => {
    if (inFlight.current || previous.success) return previous;
    inFlight.current = true;
    try {
      const result = await (restoring ? restoreQrCodeAction : deleteQrCodeAction)({}, formData);
      if (result.error) return { error: result.error };
      if (result.success) {
        router.refresh();
        return { success: true };
      }
      return { error: "No se pudo completar la acción. Vuelve a intentarlo." };
    } catch {
      return { error: "No se pudo completar la acción. Vuelve a intentarlo." };
    } finally {
      inFlight.current = false;
    }
  }, {});

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !pending && !inFlight.current) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup initialFocus={cancelRef} finalFocus={finalFocus} className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none">
          <Dialog.Title className="text-lg font-semibold">{restoring ? "Restaurar QR" : "Eliminar QR"}</Dialog.Title>
          <Dialog.Description className="break-words text-sm text-muted-foreground">
            {restoring ? `Se restaurará "${row.name}" con su estado anterior, incluido si estaba archivado o deshabilitado.` : row.mode === "dynamic" ? `Al mover "${row.name}" a la papelera, sus códigos QR impresos dejarán de funcionar. Puedes restaurarlo después. Archivar es distinto: conserva los escaneos activos.` : `Se moverá "${row.name}" a la papelera. Las copias impresas de este QR estático no se pueden desactivar: su contenido seguirá siendo legible. Puedes restaurarlo después.`}
          </Dialog.Description>
          {error && !pending ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          {success ? <p role="status" className="text-sm text-accent">{restoring ? "Código QR restaurado." : "Código QR movido a la papelera."}</p> : null}
          <form action={submit} aria-busy={pending} className="flex flex-wrap justify-end gap-3">
            <input type="hidden" name="id" value={row.id} />
            <Button ref={cancelRef} type="button" variant="outline" disabled={pending} onClick={onClose}>{success ? "Cerrar" : "Cancelar"}</Button>
            {!success ? <Button type="submit" variant={restoring ? "default" : "destructive"} disabled={pending}>{pending ? <><BinaryLoader />Procesando...</> : restoring ? "Restaurar QR" : "Mover a la papelera"}</Button> : null}
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
