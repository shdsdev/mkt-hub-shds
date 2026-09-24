"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, QrCode, IdCard, Mail, MessageSquare, Wifi, FileText, X } from "lucide-react";
import { Download, DownloadCloud, Image, ImageDown, FileOutput, Archive, Check, Pencil } from "lucide";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BorderBeam } from "border-beam";
import { CreateQrModal } from "./create-qr-modal";
import { archiveQrCodeAction, updateDynamicQrUtmAction, updateQrNameAction } from "./actions";
import { updateDestinationAction } from "../links/actions";
import { BinaryLoader } from "@/components/binary-loader";
import { CopyButton } from "@/components/copy-button";
import { HoverMorphIcon } from "@/components/hover-morph-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { requiresGroupSelection, type QrGroupTab } from "./qr-list-group-state";

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
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  payload?: string;
  name: string;
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
  filterFolders,
  filterCampaigns,
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
  filterFolders: Folder[];
  filterCampaigns: Campaign[];
  utmPresets: UtmPreset[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
  total: number;
  page: number;
  pageSize: number;
  filter: Omit<QrCodeListFilter, "page" | "pageSize">;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedGroupTab, setSelectedGroupTab] = useState<QrGroupTab>("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const [editingQrId, setEditingQrId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(filter.search ?? "");
  const searchParamRef = useRef(filter.search ?? "");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editingRow = rows.find((r) => r.id === editingQrId);
  const groupTab = filter.folderId ? "folders" : filter.campaignId ? "campaigns" : selectedGroupTab;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (searchParamRef.current !== (filter.search ?? "")) {
    searchParamRef.current = filter.search ?? "";
    setSearchText(filter.search ?? "");
  }
  const hasActiveFilter = Boolean(filter.status || filter.mode || filter.folderId || filter.campaignId || filter.search);
  const needsGroupSelection = requiresGroupSelection(groupTab, filter.folderId, filter.campaignId);
  const visibleRows = needsGroupSelection ? [] : rows;
  const hasNoAvailableGroups =
    (groupTab === "folders" && filterFolders.length === 0) ||
    (groupTab === "campaigns" && filterCampaigns.length === 0);

  function pushFilter(values: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateQrModal
          organizationId={organizationId}
          folders={folders}
          campaigns={campaigns}
          utmPresets={utmPresets}
          templates={templates}
          defaultLogoUrl={defaultLogoUrl}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={groupTab}
          onValueChange={(value) => {
            const nextTab = value as QrGroupTab;
            setSelectedGroupTab(nextTab);
            pushFilter({ folder: undefined, campaign: undefined });
          }}
        >
          <TabsList aria-label="Agrupar códigos QR">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="folders">Carpetas</TabsTrigger>
            <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          </TabsList>
        </Tabs>

        {groupTab === "folders" && (
          <Select disabled={filterFolders.length === 0} value={filter.folderId ?? null} onValueChange={(value) => pushFilter({ folder: value ?? undefined, campaign: undefined })}>
            <SelectTrigger aria-label="Filtrar por carpeta"><SelectValue placeholder="Seleccionar carpeta" /></SelectTrigger>
            <SelectContent><SelectGroup>{filterFolders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        )}

        {groupTab === "campaigns" && (
          <Select disabled={filterCampaigns.length === 0} value={filter.campaignId ?? null} onValueChange={(value) => pushFilter({ campaign: value ?? undefined, folder: undefined })}>
            <SelectTrigger aria-label="Filtrar por campaña"><SelectValue placeholder="Seleccionar campaña" /></SelectTrigger>
            <SelectContent><SelectGroup>{filterCampaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        )}

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

        <BorderBeam
          size="sm"
          colorVariant="mono"
          theme="dark"
          strength={0.6}
          active={searchFocused}
          className="min-w-64 flex-1"
        >
          <input
            value={searchText}
            onChange={(event) => {
              const value = event.target.value;
              setSearchText(value);
              pushFilter({ q: value || undefined });
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por destino, URL o contenido"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </BorderBeam>

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
      </div>

      {needsGroupSelection && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-12 text-center">
          <p className="font-medium">
            {hasNoAvailableGroups
              ? groupTab === "campaigns"
                ? "No hay campañas activas con códigos QR"
                : "No hay carpetas con códigos QR"
              : groupTab === "campaigns"
                ? "Selecciona una campaña activa"
                : "Selecciona una carpeta"}
          </p>
          <p className="text-sm text-muted-foreground">
            {hasNoAvailableGroups
              ? "Crea o asigna un código QR a un grupo para verlo aquí."
              : groupTab === "campaigns"
                ? "Elige una campaña activa para ver sus códigos QR."
                : "Elige una carpeta para ver sus códigos QR."}
          </p>
        </div>
      )}

      {!needsGroupSelection && rows.length === 0 && !hasActiveFilter && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
          <p className="font-medium">Crea tu primer código QR</p>
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

      {!needsGroupSelection && rows.length === 0 && hasActiveFilter && (
        <p className="text-sm text-muted-foreground">
          Ningún código QR coincide con estos filtros.
        </p>
      )}

      {viewMode === "list" && visibleRows.length > 0 && (
        <ul className="space-y-3">
          {visibleRows.map((row) => (
            <QrRow key={row.id} row={row} onEdit={setEditingQrId} />
          ))}
        </ul>
      )}

      {viewMode === "grid" && visibleRows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRows.map((row) => (
            <QrCard key={row.id} row={row} onEdit={setEditingQrId} />
          ))}
        </div>
      )}

      {!needsGroupSelection && total > 0 && (
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
          linkId={editingRow.linkId!}
          name={editingRow.name}
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
        {row.groupName && <span className="text-accent">{row.groupName}</span>}
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
function QrActions({ row, onEdit }: { row: QrListRow; onEdit?: (qrId: string) => void }) {
  const archiveTooltipId = useId();
  const editTooltipId = useId();

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

function QrRow({ row, onEdit }: { row: QrListRow; onEdit?: (qrId: string) => void }) {
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
      <QrActions row={row} onEdit={onEdit} />
    </li>
  );
}

function QrCard({ row, onEdit }: { row: QrListRow; onEdit?: (qrId: string) => void }) {
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
        <QrActions row={row} onEdit={onEdit} />
      </div>
    </div>
  );
}

function EditQrModal({
  qrId,
  linkId,
  name,
  destinationUrl,
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent,
  onClose,
}: {
  qrId: string;
  linkId: string;
  name: string;
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
