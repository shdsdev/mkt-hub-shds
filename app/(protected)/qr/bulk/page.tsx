import { BulkQrImport } from "./bulk-qr-import";

export default function BulkQrImportPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-semibold">Importar códigos QR</h1>
        <p className="text-sm text-muted-foreground">
          Crea hasta 200 códigos QR dinámicos de sitio web desde un archivo CSV.
        </p>
      </div>
      <BulkQrImport />
    </div>
  );
}
