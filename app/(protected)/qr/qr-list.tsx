"use client";

import { useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { QrCode, IdCard, Mail, MessageSquare, Wifi, FileText, X } from "lucide-react";
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
import type { Folder } from "@/modules/links";
import type { Campaign } from "@/modules/campaigns";
import type { UtmPreset } from "@/modules/utm";
import type { QrDesignTemplateRow } from "@/modules/qr";

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
type StatusFilter = "all" | "active" | "archived";
type TypeFilter = "all" | "dynamic" | "static";

function matchesSearch(row: QrListRow, query: string): boolean {
  if (!query) return true;
  const haystack = [row.name, row.destinationUrl, row.shortUrl, row.payload].filter(Boolean).join(" ");
  return haystack.toLowerCase().includes(query.toLowerCase());
}

export function QrList({
  rows,
  organizationId,
  folders,
  campaigns,
  utmPresets,
  templates,
  defaultLogoUrl,
}: {
  rows: QrListRow[];
  organizationId: string;
  folders: Folder[];
  campaigns: Campaign[];
  utmPresets: UtmPreset[];
  templates: QrDesignTemplateRow[];
  defaultLogoUrl?: string;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [editingQrId, setEditingQrId] = useState<string | null>(null);
  const editingRow = rows.find((r) => r.id === editingQrId);

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

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (value) setStatusFilter(value as StatusFilter);
          }}
        >
          <SelectTrigger aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="archived">Archivado</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(value) => {
            if (value) setTypeFilter(value as TypeFilter);
          }}
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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por destino, URL o contenido"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </BorderBeam>

        <CreateQrModal
          organizationId={organizationId}
          folders={folders}
          campaigns={campaigns}
          utmPresets={utmPresets}
          templates={templates}
          defaultLogoUrl={defaultLogoUrl}
        />
      </div>

      {rows.length === 0 && (
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

      {rows.length > 0 && filteredRows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Ningún código QR coincide con estos filtros.
        </p>
      )}

      {viewMode === "list" && filteredRows.length > 0 && (
        <ul className="space-y-3">
          {filteredRows.map((row) => (
            <QrRow key={row.id} row={row} onEdit={setEditingQrId} />
          ))}
        </ul>
      )}

      {viewMode === "grid" && filteredRows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((row) => (
            <QrCard key={row.id} row={row} onEdit={setEditingQrId} />
          ))}
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
