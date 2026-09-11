"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Download, DownloadCloud, ArrowRight, QrCode } from "lucide";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BinaryLoader } from "@/components/binary-loader";
import { HoverMorphIcon } from "@/components/hover-morph-icon";
import { createBulkWebsiteQrCodesAction, type BulkQrImportSummary } from "../actions";
import { parseBulkQrCsv, type BulkQrCsvPreview } from "./bulk-csv";

function StatusBadge({
  variant,
  children,
}: {
  variant: "ready" | "invalid" | "excluded" | "created" | "failed";
  children: React.ReactNode;
}) {
  const styles =
    variant === "ready" || variant === "created"
      ? "bg-accent/20 text-accent"
      : variant === "invalid" || variant === "failed"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${styles}`}>{children}</span>;
}

function PreviewRow({
  rowNumber,
  title,
  url,
  badge,
  detail,
}: {
  rowNumber: number;
  title: string;
  url: string;
  badge: React.ReactNode;
  detail?: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="shrink-0 font-mono text-xs text-muted-foreground">#{rowNumber}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{title || "Sin título"}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
        {detail && <p className="text-xs text-destructive">{detail}</p>}
      </div>
      {badge}
    </li>
  );
}

export function BulkQrImport() {
  const [preview, setPreview] = useState<BulkQrCsvPreview | null>(null);
  const [summary, setSummary] = useState<BulkQrImportSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSummary(null);
    if (!file) {
      setPreview(null);
      return;
    }

    try {
      setPreview(parseBulkQrCsv(await file.text()));
    } catch {
      setPreview({
        readyRows: [],
        invalidRows: [],
        excludedRows: [],
        fileError: "No se pudo leer el archivo CSV.",
      });
    }
  }

  function handleSubmit() {
    if (!preview || preview.readyRows.length === 0 || isPending) return;

    startTransition(async () => {
      setSummary(await createBulkWebsiteQrCodesAction(preview.readyRows));
    });
  }

  const readyCount = preview?.readyRows.length ?? 0;
  const createLabel = readyCount === 1 ? "Crear 1 código QR" : `Crear ${readyCount} códigos QR`;

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="font-medium">Archivo CSV</h2>
          <p className="text-sm text-muted-foreground">
            La primera fila es el encabezado. Usa las columnas URL y Título del código QR
            (referencia), con un máximo de 200 filas.
          </p>
        </div>

        <a
          href="/qr/bulk/template"
          download
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <HoverMorphIcon idle={Download} active={DownloadCloud} />
          Descargar plantilla CSV
        </a>

        <div className="space-y-1.5 border-t border-border pt-4">
          <label htmlFor="bulk-qr-csv" className="text-sm text-muted-foreground">
            Seleccionar archivo CSV
          </label>
          <input
            id="bulk-qr-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
          />
        </div>
      </section>

      {preview?.fileError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {preview.fileError}
        </p>
      )}

      {preview && !preview.fileError && (
        <section className="space-y-6 rounded-lg border border-border bg-card p-6" aria-label="Vista previa de importación">
          {preview.readyRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium">Listas para crear ({preview.readyRows.length})</h2>
              <ul className="space-y-1.5">
                {preview.readyRows.map((row) => (
                  <PreviewRow
                    key={row.rowNumber}
                    rowNumber={row.rowNumber}
                    title={row.title}
                    url={row.url}
                    badge={<StatusBadge variant="ready">Lista</StatusBadge>}
                  />
                ))}
              </ul>
            </div>
          )}

          {preview.invalidRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium">Filas con errores ({preview.invalidRows.length})</h2>
              <ul className="space-y-1.5">
                {preview.invalidRows.map((row) => (
                  <PreviewRow
                    key={row.rowNumber}
                    rowNumber={row.rowNumber}
                    title={row.title}
                    url={row.url}
                    detail={row.error}
                    badge={<StatusBadge variant="invalid">Error</StatusBadge>}
                  />
                ))}
              </ul>
            </div>
          )}

          {preview.excludedRows.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium">Filas excluidas por el límite ({preview.excludedRows.length})</h2>
              <ul className="space-y-1.5">
                {preview.excludedRows.map((row) => (
                  <PreviewRow
                    key={row.rowNumber}
                    rowNumber={row.rowNumber}
                    title={row.title}
                    url={row.url}
                    badge={<StatusBadge variant="excluded">Excluida</StatusBadge>}
                  />
                ))}
              </ul>
            </div>
          )}

          {readyCount > 0 && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <Button type="button" onClick={handleSubmit} disabled={isPending}>
                  {isPending ? (
                    <>
                      <BinaryLoader /> Creando códigos QR…
                    </>
                  ) : (
                    createLabel
                  )}
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {summary && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-6" aria-labelledby="bulk-qr-results">
          <h2 id="bulk-qr-results" className="font-medium">
            Resultado de la importación
          </h2>

          {summary.error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {summary.error}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">
              Solicitados: <span className="font-medium text-foreground">{summary.requested}</span>
            </span>
            <span className="text-muted-foreground">
              Creados: <span className="font-medium text-accent">{summary.created}</span>
            </span>
            <span className="text-muted-foreground">
              Fallidos: <span className="font-medium text-destructive">{summary.failed}</span>
            </span>
          </div>

          <ul className="space-y-1.5">
            {summary.results.map((result, index) => (
              <PreviewRow
                key={`${result.rowNumber}-${result.status}-${index}`}
                rowNumber={result.rowNumber}
                title={result.title}
                url={result.status === "created" ? result.qrCodeId : ""}
                detail={result.status === "failed" ? result.error : undefined}
                badge={
                  <StatusBadge variant={result.status === "created" ? "created" : "failed"}>
                    {result.status === "created" ? "Creado" : "Falló"}
                  </StatusBadge>
                }
              />
            ))}
          </ul>

          <Link
            href="/qr"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <HoverMorphIcon idle={QrCode} active={ArrowRight} />
            Ver códigos QR
          </Link>
        </section>
      )}
    </div>
  );
}
