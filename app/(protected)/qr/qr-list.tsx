"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Image as ImageIcon, Archive as ArchiveIcon, QrCode } from "lucide-react";
import { CreateQrModal } from "./create-qr-modal";
import { archiveQrCodeAction } from "./actions";
import { CopyButton } from "@/components/copy-button";

export type QrListRow = {
  id: string;
  mode: "dynamic" | "static";
  status: "active" | "archived" | "disabled";
  createdAt: Date;
  logoUrl: string | null;
  scanCount: number;
  destinationUrl?: string;
  shortUrl?: string;
  linkId?: string;
  payload?: string;
};

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "active" | "archived";
type TypeFilter = "all" | "dynamic" | "static";

function matchesSearch(row: QrListRow, query: string): boolean {
  if (!query) return true;
  const haystack = [row.destinationUrl, row.shortUrl, row.payload].filter(Boolean).join(" ");
  return haystack.toLowerCase().includes(query.toLowerCase());
}

export function QrList({ rows, organizationId }: { rows: QrListRow[]; organizationId: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .filter((row) => typeFilter === "all" || row.mode === typeFilter)
      .filter((row) => matchesSearch(row, search));
  }, [rows, statusFilter, typeFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-input">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? "bg-primary/20" : ""}`}
          >
            Cuadrícula
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-primary/20" : ""}`}
          >
            Lista
          </button>
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="archived">Archivado</option>
        </select>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">Todos los tipos</option>
          <option value="dynamic">Sitio web</option>
          <option value="static">Texto fijo</option>
        </select>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por destino, URL o contenido"
          className="min-w-64 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />

        <CreateQrModal organizationId={organizationId} />
      </div>

      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
          <p className="font-medium">Crea tu primer código QR</p>
          <p className="text-sm text-muted-foreground">
            Elige un tipo, agrega tu contenido, elige un color y después gestiona todo desde acá.
          </p>
          <CreateQrModal organizationId={organizationId} />
        </div>
      )}

      {rows.length > 0 && filteredRows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Ningún código QR coincide con estos filtros.
        </p>
      )}

      {viewMode === "list" && filteredRows.length > 0 && (
        <ul className="space-y-3">
          {filteredRows.map((row) => (
            <QrRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      {viewMode === "grid" && filteredRows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((row) => (
            <QrCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function QrThumbnail({ id, className }: { id: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/qr/${id}/download?format=png`} alt="QR code" className={className} />
  );
}

function StatusBadge({ status }: { status: QrListRow["status"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        status === "active" ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
      }`}
    >
      {status === "active" ? "Activo" : "Archivado"}
    </span>
  );
}

function QrHeading({ row }: { row: QrListRow }) {
  const heading = row.mode === "dynamic" ? row.destinationUrl : row.payload;
  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate font-heading font-semibold">{heading}</p>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {row.mode === "dynamic" ? "Sitio web" : "Texto fijo"}
        <span>{row.createdAt.toLocaleDateString()}</span>
        <StatusBadge status={row.status} />
      </p>
      {row.mode === "dynamic" && row.shortUrl && (
        <p className="flex items-center gap-1.5 text-sm text-accent">
          {row.shortUrl}
          <CopyButton value={row.shortUrl} />
        </p>
      )}
    </div>
  );
}

function QrScanCount({ scanCount }: { scanCount: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
      <QrCode size={16} />
      <span className="font-heading text-lg font-semibold text-foreground">{scanCount}</span>
      <span className="text-xs">escaneos</span>
    </div>
  );
}

function QrActions({ row }: { row: QrListRow }) {
  return (
    <div
      className="flex items-center gap-3 text-muted-foreground"
      onClick={(event) => event.stopPropagation()}
    >
      <a
        href={`/qr/${row.id}/download?format=png`}
        title="Descargar PNG"
        className="hover:text-foreground"
      >
        <Download size={16} />
      </a>
      {!row.logoUrl && (
        <a
          href={`/qr/${row.id}/download?format=svg`}
          title="Descargar SVG"
          className="hover:text-foreground"
        >
          <ImageIcon size={16} />
        </a>
      )}
      {row.status === "active" && (
        <form action={archiveQrCodeAction}>
          <input type="hidden" name="id" value={row.id} />
          <button type="submit" title="Archivar" className="hover:text-foreground">
            <ArchiveIcon size={16} />
          </button>
        </form>
      )}
    </div>
  );
}

// Dynamic QR cards navigate to their analytics page on click; static ones don't (untrackable by
// design, DATABASE.md) — same condition the old "Analytics" action icon used to gate on.
function useCardNavigation(row: QrListRow) {
  const router = useRouter();
  const clickable = row.mode === "dynamic" && Boolean(row.linkId);
  return {
    clickable,
    onClick: clickable ? () => router.push(`/analytics/${row.linkId}`) : undefined,
  };
}

function QrRow({ row }: { row: QrListRow }) {
  const { clickable, onClick } = useCardNavigation(row);
  return (
    <li
      onClick={onClick}
      className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 ${
        clickable ? "cursor-pointer hover:border-primary/50" : ""
      }`}
    >
      <QrThumbnail id={row.id} className="h-16 w-16 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <QrHeading row={row} />
      </div>
      <QrScanCount scanCount={row.scanCount} />
      <QrActions row={row} />
    </li>
  );
}

function QrCard({ row }: { row: QrListRow }) {
  const { clickable, onClick } = useCardNavigation(row);
  return (
    <div
      onClick={onClick}
      className={`space-y-3 rounded-lg border border-border bg-card p-4 ${
        clickable ? "cursor-pointer hover:border-primary/50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <QrThumbnail id={row.id} className="h-16 w-16 shrink-0 rounded-md" />
        <QrHeading row={row} />
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <QrScanCount scanCount={row.scanCount} />
        <QrActions row={row} />
      </div>
    </div>
  );
}
