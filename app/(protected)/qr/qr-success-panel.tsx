export function QrSuccessPanel({ qrCodeId, onClose }: { qrCodeId: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h3 className="font-heading text-lg font-semibold">¡Tu código QR está listo!</h3>
      <p className="text-sm text-muted-foreground">Escanéalo para probarlo.</p>

      <div className="rounded-md border border-border bg-background p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/qr/${qrCodeId}/download?format=png`}
          alt="Código QR generado"
          className="h-48 w-48"
        />
      </div>

      <div className="flex gap-3">
        <a
          href={`/qr/${qrCodeId}/download?format=png`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Descargar PNG
        </a>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-input px-4 py-2 text-sm"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
