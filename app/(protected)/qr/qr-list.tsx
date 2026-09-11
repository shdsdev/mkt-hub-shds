"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { Download, DownloadCloud, Image, ImageDown, Archive, Check } from "lucide";
import { BorderBeam } from "border-beam";
import { CreateQrModal } from "./create-qr-modal";
import { archiveQrCodeAction } from "./actions";
import { CopyButton } from "@/components/copy-button";
import { HoverMorphIcon } from "@/components/hover-morph-icon";

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
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => statusFilter === "all" || row.status === statusFilter)
      .filter((row) => typeFilter === "all" || row.mode === typeFilter)
      .filter((row) => matchesSearch(row, search));
  }, [rows, statusFilter, typeFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-input">
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

        <BorderBeam
          size="sm"
          colorVariant="mono"
          theme="dark"
          strength={0.6}
          active={searchFocused}
          className="min-w-64 flex-1"
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por destino, URL o contenido"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </BorderBeam>

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
      <p className="truncate font-mono text-sm font-medium">{heading}</p>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {row.mode === "dynamic" ? "Sitio web" : "Texto fijo"}
        <span>{row.createdAt.toLocaleDateString()}</span>
        <StatusBadge status={row.status} />
      </p>
      {row.mode === "dynamic" && row.shortUrl && (
        <p className="flex min-w-0 items-center gap-1.5 font-mono text-sm text-accent">
          <span className="truncate">{row.shortUrl}</span>
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

// Tooltip markup written directly (not the shared <Tooltip>) so the real <a>/<button> stays the
// one tab stop and carries .t-tt-trigger itself — see src/components/tooltip.tsx's docstring.
function QrActions({ row }: { row: QrListRow }) {
  const pngTooltipId = useId();
  const svgTooltipId = useId();
  const archiveTooltipId = useId();

  return (
    <div
      className="flex items-center gap-3 text-muted-foreground"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="t-tt-wrap">
        <a
          href={`/qr/${row.id}/download?format=png`}
          aria-describedby={pngTooltipId}
          className="t-tt-trigger hover:text-foreground"
        >
          <HoverMorphIcon idle={Download} active={DownloadCloud} />
        </a>
        <span className="t-tt" id={pngTooltipId} role="tooltip">
          Descargar PNG
        </span>
      </span>
      {!row.logoUrl && (
        <span className="t-tt-wrap">
          <a
            href={`/qr/${row.id}/download?format=svg`}
            aria-describedby={svgTooltipId}
            className="t-tt-trigger hover:text-foreground"
          >
            <HoverMorphIcon idle={Image} active={ImageDown} />
          </a>
          <span className="t-tt" id={svgTooltipId} role="tooltip">
            Descargar SVG
          </span>
        </span>
      )}
      {row.status === "active" && (
        <form action={archiveQrCodeAction}>
          <input type="hidden" name="id" value={row.id} />
          <span className="t-tt-wrap">
            <button
              type="submit"
              aria-describedby={archiveTooltipId}
              className="t-tt-trigger hover:text-foreground"
            >
              <HoverMorphIcon idle={Archive} active={Check} />
            </button>
            <span className="t-tt" id={archiveTooltipId} role="tooltip">
              Archivar
            </span>
          </span>
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
