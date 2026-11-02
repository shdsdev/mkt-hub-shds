"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { parseEmailContactCsv, type ParsedEmailContactCsv } from "@/lib/email-contact-import";
import { importEmailContactsAction, type ContactActionState } from "./actions";

const initialState: ContactActionState = {};

export function ImportContactsForm({
  onBusyChange,
  onComplete,
}: {
  onBusyChange?: (busy: boolean) => void;
  onComplete?: () => void;
}) {
  const [state, action, pending] = useActionState(importEmailContactsAction, initialState);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ParsedEmailContactCsv | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  useEffect(() => {
    onBusyChange?.(pending);
  }, [onBusyChange, pending]);

  useEffect(() => {
    return () => onBusyChange?.(false);
  }, [onBusyChange]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    const content = await file.text();
    setFileName(file.name);
    setCsv(content);
    setPreview(parseEmailContactCsv(content));
  }

  function clearFile() {
    setFileName("");
    setCsv("");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validRows = preview?.rows.length ?? 0;
  const hasErrors = Boolean(preview?.errors.length);
  const importErrors = state.errors ?? [];
  const imported = (state.created ?? 0) + (state.updated ?? 0);
  const hasImportErrors = importErrors.length > 0;
  const hasWarnings = (state.warnings ?? 0) > 0;

  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      {pending ? <p role="status" className="sr-only">Importando contactos. Esperá a que termine el proceso.</p> : null}
      {state.success ? (
        <div className="space-y-5" role="status" aria-live="polite">
          <div className={`rounded-xl border p-4 ${hasImportErrors ? "border-destructive/30 bg-destructive/5" : "border-accent/30 bg-accent/5"}`}>
            <div className="flex items-start gap-3">
              {hasImportErrors ? <AlertCircle size={20} className="mt-0.5 shrink-0 text-destructive" /> : <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-accent" />}
              <div className="min-w-0">
                <h3 className="font-semibold">{hasImportErrors ? "Importación parcial" : hasWarnings ? "Importación completada con advertencias" : "Importación completada"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{state.success}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Importados</p><p className="mt-1 text-xl font-semibold">{imported}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Nuevos</p><p className="mt-1 text-xl font-semibold">{state.created ?? 0}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Actualizados</p><p className="mt-1 text-xl font-semibold">{state.updated ?? 0}</p></div>
            <div className={`rounded-lg border p-3 ${hasImportErrors ? "border-destructive/30" : "border-border"}`}><p className="text-xs text-muted-foreground">Con error</p><p className={`mt-1 text-xl font-semibold ${hasImportErrors ? "text-destructive" : ""}`}>{importErrors.length}</p></div>
          </div>

          {hasWarnings ? <p className="text-xs leading-5 text-muted-foreground">{state.warnings} filas quedaron como pendientes porque les faltaba evidencia de consentimiento válida.</p> : null}

          {hasImportErrors ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">Filas no importadas</p>
              <ul className="mt-2 space-y-1 text-xs text-destructive">
                {importErrors.slice(0, 5).map((error) => <li key={`${error.rowNumber}-${error.message}`}>Fila {error.rowNumber}: {error.message}</li>)}
              </ul>
              {importErrors.length > 5 ? <p className="mt-2 text-xs text-destructive">Y {importErrors.length - 5} errores más.</p> : null}
            </div>
          ) : null}

          <button type="button" onClick={onComplete} className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Aceptar</button>
        </div>
      ) : <div inert={pending} className="space-y-5">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Importar contactos</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Subí un CSV de Marketing Hub o exportado desde Mailchimp.</p>
        </div>
        <a href="/email-marketing/contacts/template" download className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline">
          <Download size={14} /> Descargar plantilla
        </a>
      </div>

      <input type="hidden" name="csv" value={csv} readOnly />
      <input ref={inputRef} type="file" accept=".csv,text/csv" disabled={pending} onChange={(event) => void readFile(event.target.files?.[0])} className="sr-only" />
      {!preview ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <FileSpreadsheet size={25} className="mx-auto text-primary" />
          <p className="mt-3 text-sm font-medium">Selecciona tu archivo CSV</p>
           <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Aceptamos datos de contacto, etiquetas, estado de suscripción y evidencia de consentimiento.</p>
          <button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50">
            <Upload size={14} /> Seleccionar CSV
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
            <FileSpreadsheet size={20} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{fileName}</p><p className="text-xs text-muted-foreground">{validRows} contactos listos para importar</p></div>
            <button type="button" disabled={pending} onClick={clearFile} aria-label="Quitar archivo seleccionado" className="text-muted-foreground hover:text-foreground disabled:opacity-50"><X size={16} /></button>
          </div>
          <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${hasErrors ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-accent/30 bg-accent/5 text-accent"}`}>
            {hasErrors ? <AlertCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
            <p>{hasErrors ? `${validRows} filas válidas. Las filas con errores no se importarán.` : `${validRows} filas válidas. No se encontraron errores.`}</p>
          </div>
           {validRows > 0 ? <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border bg-background/40 text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Nombre</th><th className="px-3 py-2 font-medium">Teléfono</th><th className="px-3 py-2 font-medium">Etiquetas</th><th className="px-3 py-2 font-medium">Estado</th><th className="px-3 py-2 font-medium">Consentimiento</th></tr></thead><tbody className="divide-y divide-border">{preview.rows.slice(0, 5).map((row) => <tr key={row.rowNumber}><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.fullName || "—"}</td><td className="px-3 py-2">{row.phone || "—"}</td><td className="px-3 py-2">{row.tags.join(", ") || "—"}</td><td className="px-3 py-2">{row.subscriptionStatus || "pending"}</td><td className="px-3 py-2">{row.consentSource ? `${row.consentSource}${row.consentedAt ? ` · ${row.consentedAt.slice(0, 10)}` : ""}` : "—"}{row.warnings?.map((warning) => <p key={warning} className="mt-1 text-destructive">{warning}</p>)}</td></tr>)}</tbody></table>{validRows > 5 ? <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Mostrando 5 de {validRows} contactos.</p> : null}</div> : null}
          {preview.errors.length ? <ul className="space-y-1 text-xs text-destructive">{preview.errors.slice(0, 5).map((error) => <li key={`${error.rowNumber}-${error.message}`}>Fila {error.rowNumber}: {error.message}</li>)}</ul> : null}
            <p className="text-xs leading-5 text-muted-foreground">Un contacto solo queda suscrito si el CSV incluye estado subscribed, consent_source y consented_at válidos. La importación nunca reactiva bajas o supresiones.</p>
          <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="inline-flex h-9 items-center gap-2 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"><Upload size={14} /> Cambiar archivo</button><button type="submit" disabled={pending || validRows === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">{pending ? "Importando…" : `Importar ${validRows} contactos`}</button></div>
        </div>
      )}
      {state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}
      {state.errors?.length ? <ul className="space-y-1 text-xs text-destructive">{state.errors.slice(0, 5).map((error) => <li key={`${error.rowNumber}-${error.message}`}>Fila {error.rowNumber}: {error.message}</li>)}</ul> : null}
      </div>}
    </form>
  );
}
