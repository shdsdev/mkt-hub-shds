"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateDestinationAction } from "../../links/actions";
import { updateQrNameAction } from "../../qr/actions";
import { BinaryLoader } from "@/components/binary-loader";

export function EditDestinationButton({
  qrId,
  linkId,
  name,
  destinationUrl,
}: {
  qrId: string;
  linkId: string;
  name: string;
  destinationUrl: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
      >
        <Pencil size={14} />
        Editar
      </button>
    );
  }

  return (
    <EditModal
      qrId={qrId}
      linkId={linkId}
      name={name}
      destinationUrl={destinationUrl}
      onClose={() => setOpen(false)}
    />
  );
}

function EditModal({
  qrId,
  linkId,
  name,
  destinationUrl,
  onClose,
}: {
  qrId: string;
  linkId: string;
  name: string;
  destinationUrl: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      const nameResult = await updateQrNameAction({}, formData);
      if (nameResult?.error) {
        setError(nameResult.error);
        setPending(false);
        return;
      }

      const destResult = await updateDestinationAction({}, formData);
      if (destResult?.error) {
        setError(destResult.error);
        setPending(false);
        return;
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setPending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Editar QR</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Cambiá el nombre y/o la URL de destino. La URL corta y el código QR permanecen iguales.
        </p>
        <form action={handleSubmit} className="space-y-3">
          <input type="hidden" name="qrId" value={qrId} />
          <input type="hidden" name="linkId" value={linkId} />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground uppercase">Nombre</label>
            <input
              name="name"
              type="text"
              defaultValue={name}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground uppercase">URL de destino</label>
            <input
              name="destinationUrl"
              type="url"
              defaultValue={destinationUrl}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? <BinaryLoader /> : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
