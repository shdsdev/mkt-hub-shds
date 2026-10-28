"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  List,
  QrCode,
  IdCard,
  Mail,
  MessageSquare,
  Wifi,
  FileText,
  X,
  Trash2,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { Download, DownloadCloud, Image, ImageDown, FileOutput, Archive, Check, Pencil } from "lucide";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "border-beam";
import { CreateQrModal } from "./create-qr-modal";
import { archiveQrCodeAction, updateDynamicQrUtmAction, updateQrMetadataAction, updateQrNameAction } from "./actions";
import { updateDestinationAction } from "../links/actions";
import { PlacementImageUpload } from "./placement-image-upload";
import { BinaryLoader } from "@/components/binary-loader";
import { CopyButton } from "@/components/copy-button";
import { HoverMorphIcon } from "@/components/hover-morph-icon";
import { PlacementImagePreview } from "@/components/placement-image-preview";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";
import type { UtmPreset } from "@/modules/utm";
import type { QrCodeListFilter, QrDesignTemplateRow } from "@/modules/qr";
import { QrSidebar, type QrGroup, type QrNavigationCounts } from "./qr-sidebar";
import { QrLifecycleDialog } from "./qr-lifecycle-dialog";

export type QrListRow = {
  id: string;
  mode: "dynamic" | "static";
  status: "active" | "archived" | "disabled";
  deletedAt: Date | null;
  createdAt: Date;
  logoUrl: string | null;
  placementImageUrl?: string | null;
  scanCount: number;
  destinationUrl?: string;
  shortUrl?: string;
  linkId?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  payload?: string;
  name: string;
  description?: string | null;
  staticKind?: "text" | "vcard" | "email" | "sms" | "wifi";
  groupName?: string;
  folderId: string | null;
  campaignId: string | null;
};

// Explicit locale + timeZone (not the runtime default) — this is a Client Component, so this
// text renders once during SSR (server locale/timezone) and again on hydration (the visitor's
// browser). Left to toLocaleDateString()'s defaults those two can disagree and React throws
// error #418 ("text content does not match server-rendered HTML").
function formatCreatedAt(date: Date): string {
  return date.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
}

const STATIC_KIND_ICON: Record<NonNullable<QrListRow["staticKind"]>, typeof FileText> = {
  text: FileText,
  vcard: IdCard,
  email: Mail,
  sms: MessageSquare,
  wifi: Wifi,
};

type ViewMode = "grid" | "list";

function ViewModeButton({
  label,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: typeof LayoutGrid;
  onClick: () => void;
}) {
  const tooltipId = useId();

  return (
    <span className="t-tt-wrap">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-pressed={active}
        onClick={onClick}
        className={`t-tt-trigger rounded-md p-2 transition-colors ${
          active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon size={16} />
      </button>
      <span className="t-tt" id={tooltipId} role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function QrList({
  rows,
  organizationId,
  folders,
  campaigns,
  navigationCounts,
  navigationCampaigns,
  utmPresets,
  templates,
  defaultLogoUrl,
  total,
  page,
  pageSize,
  filter,
}: {
  rows: QrListRow[];
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  navigationCounts: QrNavigationCounts;
  navigationCampaigns: Campaign[];
  utmPresets: UtmPreset[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
  total: number;
  page: number;
  pageSize: number;
  filter: Omit<QrCodeListFilter, "page" | "pageSize">;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [lifecycleRow, setLifecycleRow] = useState<QrListRow | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [editingQrId, setEditingQrId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(filter.search ?? "");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editingRow = rows.find((r) => r.id === editingQrId && !r.deletedAt);
  const groupTitle = filter.trash ? "Papelera" : filter.folderId ? folders.find((folder) => folder.id === filter.folderId)?.name ?? "Carpeta" : filter.campaignId ? navigationCampaigns.find((campaign) => campaign.id === filter.campaignId)?.name ?? "Campaña" : "Códigos QR";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilter = Boolean(filter.status || filter.mode || filter.folderId || filter.campaignId || filter.search);
  const showClearFilters = Boolean(filter.status || filter.mode || filter.search);

  useEffect(() => {
    setSearchText(filter.search ?? "");
  }, [filter.search]);

  useEffect(() => {
    const currentQuery = filter.search ?? "";
    if (searchText === currentQuery) return;

    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchText) params.set("q", searchText);
      else params.delete("q");
      params.delete("page");
      router.push(`${pathname}${params.size ? `?${params}` : ""}`);
    }, 250);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText, filter.search, pathname, router, searchParams]);

  function pushFilter(values: Record<string, string | undefined>) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const params = new URLSearchParams(searchParams.toString());
    if (searchText) params.set("q", searchText);
    else params.delete("q");
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  function pushPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params}`);
  }

  function clearFilters() {
    setSearchText("");
    pushFilter({ status: undefined, mode: undefined, q: undefined });
  }

  function selectGroup(group: QrGroup) {
    pushFilter({ folder: group.folder, campaign: group.campaign, trash: group.trash });
  }

  const navigationProps = {
    folders,
    campaigns: navigationCampaigns,
    counts: navigationCounts,
    selected: { folder: filter.folderId, campaign: filter.campaignId, trash: filter.trash ? "1" : undefined },
    onSelect: selectGroup,
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      <QrSidebar {...navigationProps} />
      <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 ref={resultsRef} tabIndex={-1} className="break-words text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="hidden lg:inline">{groupTitle}</span>
            <span className="lg:hidden">{groupTitle}</span>
          </h2>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <QrSidebar {...navigationProps} mobile label="Conjuntos" />
          {!filter.trash ? <CreateQrModal
            organizationId={organizationId}
            folders={folders}
            campaigns={campaigns}
            utmPresets={utmPresets}
            templates={templates}
            defaultLogoUrl={defaultLogoUrl}
          /> : null}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <BorderBeam
            size="sm"
            colorVariant="mono"
            theme="dark"
            strength={0.6}
            active={searchFocused}
            className="min-w-0 flex-1"
          >
            <input
              value={searchText}
              aria-label={`Buscar en ${groupTitle}`}
              onChange={(event) => setSearchText(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar por destino, URL o contenido"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </BorderBeam>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filter.status ?? "all"}
            onValueChange={(value) => pushFilter({ status: value === "all" ? undefined : value ?? undefined })}
          >
            <SelectTrigger aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="archived">Archivado</SelectItem>
                <SelectItem value="disabled">Deshabilitado</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={filter.mode ?? "all"}
            onValueChange={(value) => pushFilter({ mode: value === "all" ? undefined : value ?? undefined })}
          >
            <SelectTrigger aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="dynamic">Sitio web</SelectItem>
                <SelectItem value="static">Texto fijo</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="flex items-center rounded-md border border-input p-0.5">
            <ViewModeButton
              label="Cuadrícula"
              active={viewMode === "grid"}
              icon={LayoutGrid}
              onClick={() => setViewMode("grid")}
            />
            <ViewModeButton
              label="Lista"
              active={viewMode === "list"}
              icon={List}
              onClick={() => setViewMode("list")}
            />
          </div>

          {showClearFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 && !hasActiveFilter && !filter.trash && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-12 text-center">
          <QrCode size={48} className="text-muted-foreground" />
          <p className="font-medium text-lg">Crea tu primer código QR</p>
          <p className="text-sm text-muted-foreground">
            Elige un tipo, agrega tu contenido, elige un color y después gestiona todo desde acá.
          </p>
          <CreateQrModal
            organizationId={organizationId}
            folders={folders}
            campaigns={campaigns}
            utmPresets={utmPresets}
            templates={templates}
            defaultLogoUrl={defaultLogoUrl}
          />
        </div>
      )}

      {rows.length === 0 && (hasActiveFilter || filter.trash) && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-12 text-center">
          <SearchX size={48} className="text-muted-foreground" />
          <p className="font-medium text-lg">{filter.trash && !showClearFilters ? "La papelera está vacía" : "Ningún código QR coincide"}</p>
          <p className="text-sm text-muted-foreground">{filter.trash && !showClearFilters ? "Los códigos QR eliminados aparecerán aquí para restaurarlos." : "Prueba con otros términos dentro de este grupo o limpia los filtros."}</p>
          {showClearFilters ? <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Limpiar filtros
          </Button> : null}
        </div>
      )}

      {viewMode === "list" && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => (
            <QrRow key={row.id} row={row} onEdit={setEditingQrId} onLifecycle={setLifecycleRow} />
          ))}
        </ul>
      )}

      {viewMode === "grid" && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <QrCard key={row.id} row={row} onEdit={setEditingQrId} onLifecycle={setLifecycleRow} />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationFirst href="#" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined} className={page === 1 ? "pointer-events-none opacity-50" : undefined} onClick={(event) => { event.preventDefault(); if (page > 1) pushPage(1); }} /></PaginationItem>
              <PaginationItem><PaginationPrevious href="#" aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined} className={page === 1 ? "pointer-events-none opacity-50" : undefined} onClick={(event) => { event.preventDefault(); if (page > 1) pushPage(page - 1); }} /></PaginationItem>
              <PaginationItem><PaginationNext href="#" aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined} className={page >= totalPages ? "pointer-events-none opacity-50" : undefined} onClick={(event) => { event.preventDefault(); if (page < totalPages) pushPage(page + 1); }} /></PaginationItem>
              <PaginationItem><PaginationLast href="#" aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined} className={page >= totalPages ? "pointer-events-none opacity-50" : undefined} onClick={(event) => { event.preventDefault(); if (page < totalPages) pushPage(totalPages); }} /></PaginationItem>
            </PaginationContent>
          </Pagination>
          <Select value={String(page)} onValueChange={(value) => { if (value) pushPage(Number(value)); }}>
            <SelectTrigger aria-label="Ir a página"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{Array.from({ length: totalPages }, (_, index) => <SelectItem key={index + 1} value={String(index + 1)}>Página {index + 1}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
      )}

      {editingRow && (
        <EditQrModal
          qrId={editingRow.id}
          organizationId={organizationId}
          linkId={editingRow.linkId!}
          name={editingRow.name}
          description={editingRow.description}
          placementImageUrl={editingRow.placementImageUrl}
          destinationUrl={editingRow.destinationUrl!}
          utmSource={editingRow.utmSource}
          utmMedium={editingRow.utmMedium}
          utmCampaign={editingRow.utmCampaign}
          utmTerm={editingRow.utmTerm}
          utmContent={editingRow.utmContent}
          onClose={() => setEditingQrId(null)}
        />
      )}
      </div>
      {lifecycleRow ? <QrLifecycleDialog key={`${lifecycleRow.id}-${Boolean(lifecycleRow.deletedAt)}`} row={lifecycleRow} finalFocus={resultsRef} onClose={() => setLifecycleRow(null)} /> : null}
    </div>
  );
}

function QrThumbnail({ id, className, deleted }: { id: string; className: string; deleted?: boolean }) {
  if (deleted) return <div className={`${className} flex items-center justify-center bg-muted text-muted-foreground`}><QrCode aria-label="QR en papelera" size={28} /></div>;
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
      {status === "active" ? "Activo" : status === "disabled" ? "Deshabilitado" : "Archivado"}
    </span>
  );
}

const STATIC_KIND_LABEL: Record<NonNullable<QrListRow["staticKind"]>, string> = {
  text: "Texto fijo",
  vcard: "vCard",
  email: "Correo electrónico",
  sms: "SMS",
  wifi: "WiFi",
};

function QrHeading({ row }: { row: QrListRow }) {
  const detail = row.mode === "dynamic" ? row.destinationUrl : row.payload;
  const typeLabel = row.mode === "dynamic" ? "Sitio web" : STATIC_KIND_LABEL[row.staticKind ?? "text"];
  const TypeIcon = row.mode === "static" ? STATIC_KIND_ICON[row.staticKind ?? "text"] : undefined;
  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate text-sm font-medium">{row.name}</p>
      {detail && <p className="truncate font-mono text-xs text-muted-foreground">{detail}</p>}
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {TypeIcon && <TypeIcon size={12} />}
          {typeLabel}
        </span>
        <span>{formatCreatedAt(row.createdAt)}</span>
        <StatusBadge status={row.status} />
        {row.deletedAt ? <span className="text-muted-foreground">En papelera</span> : null}
        {row.groupName && <span className="text-accent">{row.groupName}</span>}
      </p>
      {row.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{row.description}</p> : null}
      {!row.deletedAt && row.mode === "dynamic" && row.shortUrl && (
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
type QrItemProps = { row: QrListRow; onEdit?: (qrId: string) => void; onLifecycle: (row: QrListRow) => void };

function QrActions({ row, onEdit, onLifecycle }: QrItemProps) {
  const archiveTooltipId = useId();
  const editTooltipId = useId();

  if (row.deletedAt) return (
    <Button type="button" variant="ghost" size="sm" aria-label={`Restaurar ${row.name}`} onClick={(event) => { event.stopPropagation(); onLifecycle(row); }}>
      <RotateCcw data-icon="inline-start" />Restaurar
    </Button>
  );

  return (
    <div
      className="flex items-center gap-3 text-muted-foreground"
      onClick={(event) => event.stopPropagation()}
    >
      {row.mode === "dynamic" && row.linkId && onEdit && (
        <span className="t-tt-wrap">
          <button
            type="button"
            onClick={() => onEdit(row.id)}
            aria-label={`Editar ${row.name}`}
            aria-describedby={editTooltipId}
            className="t-tt-trigger hover:text-foreground"
          >
            <HoverMorphIcon idle={Pencil} active={Pencil} />
          </button>
          <span className="t-tt" id={editTooltipId} role="tooltip">
            Editar
          </span>
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Descargar"
          className="text-muted-foreground outline-hidden hover:text-foreground data-[popup-open]:text-foreground"
        >
          <HoverMorphIcon idle={Download} active={DownloadCloud} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<a href={`/qr/${row.id}/download?format=png`} />}>
            <HoverMorphIcon idle={Image} active={ImageDown} size={16} />
            PNG
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={`/qr/${row.id}/download?format=svg`} />}>
            <HoverMorphIcon idle={Image} active={ImageDown} size={16} />
            SVG
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={`/qr/${row.id}/download?format=ai`} />}>
            <HoverMorphIcon idle={FileOutput} active={FileOutput} size={16} />
            AI 
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {row.status === "active" && (
        <form action={archiveQrCodeAction}>
          <input type="hidden" name="id" value={row.id} />
          <span className="t-tt-wrap">
            <button
              type="submit"
              aria-describedby={archiveTooltipId}
              aria-label={`Archivar ${row.name}`}
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
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Eliminar ${row.name}`} onClick={() => onLifecycle(row)}><Trash2 /></Button>
    </div>
  );
}

// Dynamic QR cards navigate to their analytics page on click; static ones don't (untrackable by
// design, DATABASE.md) — same condition the old "Analytics" action icon used to gate on.
function useCardNavigation(row: QrListRow) {
  const router = useRouter();
  const clickable = !row.deletedAt && row.mode === "dynamic" && Boolean(row.linkId);
  return {
    clickable,
    onClick: clickable ? () => router.push(`/analytics/${row.linkId}`) : undefined,
  };
}

function QrRow({ row, onEdit, onLifecycle }: QrItemProps) {
  const { clickable, onClick } = useCardNavigation(row);
  return (
    <li
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4 ${
        clickable ? "cursor-pointer hover:border-primary/50" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <QrThumbnail id={row.id} deleted={Boolean(row.deletedAt)} className="h-16 w-16 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <QrHeading row={row} />
        </div>
      </div>
      {row.placementImageUrl ? <PlacementImagePreview src={row.placementImageUrl} /> : null}
      <div className="flex items-center justify-between gap-4 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
        <QrScanCount scanCount={row.scanCount} />
        <QrActions row={row} onEdit={onEdit} onLifecycle={onLifecycle} />
      </div>
    </li>
  );
}

function QrCard({ row, onEdit, onLifecycle }: QrItemProps) {
  const { clickable, onClick } = useCardNavigation(row);
  return (
    <div
      onClick={onClick}
      className={`space-y-3 rounded-lg border border-border bg-card p-4 ${
        clickable ? "cursor-pointer hover:border-primary/50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <QrThumbnail id={row.id} deleted={Boolean(row.deletedAt)} className="h-16 w-16 shrink-0 rounded-md" />
        <QrHeading row={row} />
      </div>
      {row.placementImageUrl ? <PlacementImagePreview src={row.placementImageUrl} /> : null}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <QrScanCount scanCount={row.scanCount} />
        <QrActions row={row} onEdit={onEdit} onLifecycle={onLifecycle} />
      </div>
    </div>
  );
}

function EditQrModal({
  qrId,
  organizationId,
  linkId,
  name,
  description,
  placementImageUrl,
  destinationUrl,
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent,
  onClose,
}: {
  qrId: string;
  organizationId: string;
  linkId: string;
  name: string;
  description?: string | null;
  placementImageUrl?: string | null;
  destinationUrl: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDescription, setCurrentDescription] = useState(description ?? "");
  const [currentPlacementImageUrl, setCurrentPlacementImageUrl] = useState(placementImageUrl ?? undefined);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    try {
      // Update name
      const nameResult = await updateQrNameAction({}, formData);
      if (nameResult?.error) {
        setError(nameResult.error);
        setPending(false);
        return;
      }

      const metadataResult = await updateQrMetadataAction({}, formData);
      if (metadataResult?.error) {
        setError(metadataResult.error);
        setPending(false);
        return;
      }

      // Update destination
      const destResult = await updateDestinationAction({}, formData);
      if (destResult?.error) {
        setError(destResult.error);
        setPending(false);
        return;
      }

      const utmValuesChanged = (
        formData.get("utmSource") !== (utmSource ?? "") ||
        formData.get("utmMedium") !== (utmMedium ?? "") ||
        formData.get("utmCampaign") !== (utmCampaign ?? "") ||
        formData.get("utmTerm") !== (utmTerm ?? "") ||
        formData.get("utmContent") !== (utmContent ?? "")
      );
      if (utmValuesChanged) {
        const utmResult = await updateDynamicQrUtmAction({}, formData);
        if (utmResult?.error) {
          setError(utmResult.error);
          setPending(false);
          return;
        }
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
          Cambiá el nombre, la URL de destino o la atribución UTM para futuros redireccionamientos.
          El código QR impreso y la URL corta permanecen iguales.
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
            <label className="mb-1 block text-xs text-muted-foreground uppercase">Contexto o descripcion</label>
            <textarea
              name="description"
              value={currentDescription}
              onChange={(event) => setCurrentDescription(event.target.value)}
              maxLength={160}
              rows={3}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">Maximo 160 caracteres.</p>
          </div>
          <div>
            <p className="mb-1 block text-xs text-muted-foreground uppercase">Referencia visual</p>
            <PlacementImageUpload
              organizationId={organizationId}
              value={currentPlacementImageUrl}
              onUploaded={setCurrentPlacementImageUrl}
              label="Adjuntar o cambiar referencia"
            />
            <input type="hidden" name="placementImageUrl" value={currentPlacementImageUrl ?? ""} readOnly />
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground uppercase">UTM source</label>
              <input
                name="utmSource"
                defaultValue={utmSource ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground uppercase">UTM medium</label>
              <input
                name="utmMedium"
                defaultValue={utmMedium ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground uppercase">UTM campaign</label>
              <input
                name="utmCampaign"
                defaultValue={utmCampaign ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground uppercase">UTM term</label>
              <input
                name="utmTerm"
                defaultValue={utmTerm ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground uppercase">UTM content</label>
              <input
                name="utmContent"
                defaultValue={utmContent ?? ""}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
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
