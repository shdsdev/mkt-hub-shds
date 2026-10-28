"use client";

import { useId, useState } from "react";
import { ChevronDown, FolderOpen, Megaphone, PanelLeftClose, PanelLeftOpen, QrCode, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type QrNavigationCounts = { total: number; trash: number; folders: Record<string, number>; campaigns: Record<string, number> };
export type QrGroup = { folder?: string; campaign?: string; trash?: string };
type Props = {
  folders: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  counts: QrNavigationCounts;
  selected: QrGroup;
  onSelect: (group: QrGroup) => void;
};

function QrNavigation({ folders, campaigns, counts, selected, onSelect }: Props) {
  const id = useId();
  const item = (name: string, count: number, active: boolean, group: QrGroup, Icon?: typeof QrCode) => (
    <button type="button" aria-label={`${name} (${count})`} aria-current={active ? "page" : undefined} onClick={() => onSelect(group)}
      className={cn("flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0", active ? "bg-accent/15 font-semibold text-accent" : "text-foreground")}>
      {Icon ? <Icon size={16} aria-hidden="true" className="shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
      <span className="shrink-0 text-xs tabular-nums">{count}</span>
    </button>
  );
  return (
    <nav aria-label="Organizar códigos QR" className="flex min-w-0 flex-col gap-3">
      {item("Todos los QR", counts.total, !selected.folder && !selected.campaign && !selected.trash, {}, QrCode)}
      <details open className="group">
        <summary aria-controls={`${id}-folders`} className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <FolderOpen size={16} aria-hidden="true" />Carpetas<ChevronDown size={14} aria-hidden="true" className="ml-auto transition-transform group-not-open:-rotate-90 motion-reduce:transition-none" />
        </summary>
        <div id={`${id}-folders`} className="ml-2 flex flex-col gap-1 border-l border-border pl-2">
          {folders.length ? folders.map((folder) => <div key={folder.id}>{item(folder.name, counts.folders[folder.id] ?? 0, selected.folder === folder.id, { folder: folder.id })}</div>) : <p className="px-3 py-2 text-xs text-foreground/80">No hay carpetas. Puedes asignar una al crear un QR.</p>}
        </div>
      </details>
      <details open className="group">
        <summary aria-controls={`${id}-campaigns`} className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Megaphone size={16} aria-hidden="true" />Campañas<ChevronDown size={14} aria-hidden="true" className="ml-auto transition-transform group-not-open:-rotate-90 motion-reduce:transition-none" />
        </summary>
        <div id={`${id}-campaigns`} className="ml-2 flex flex-col gap-1 border-l border-border pl-2">
          {campaigns.length ? campaigns.map((campaign) => <div key={campaign.id}>{item(campaign.name, counts.campaigns[campaign.id] ?? 0, selected.campaign === campaign.id, { campaign: campaign.id })}</div>) : <p className="px-3 py-2 text-xs text-foreground/80">No hay campañas disponibles.</p>}
        </div>
      </details>
      <div className="border-t border-border pt-3">{item("Papelera", counts.trash, Boolean(selected.trash), { trash: "1" }, Trash2)}</div>
    </nav>
  );
}

export function QrSidebar({ mobile = false, label = "Todos los QR", ...props }: Props & { mobile?: boolean; label?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const id = useId();
  if (mobile) return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger
        aria-label={`Cambiar grupo: ${label}`}
        render={<Button variant="outline" className="min-h-11 max-w-full justify-between gap-2 lg:hidden" />}
      >
        <span className="truncate">{label}</span><ChevronDown size={18} aria-hidden="true" className="shrink-0" />
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:transition-none">
        <SheetHeader className="p-0 pr-10"><SheetTitle>Organizar</SheetTitle><SheetDescription className="text-foreground/80">Elige una carpeta, campaña o la papelera.</SheetDescription></SheetHeader>
        <SheetClose render={<Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Cerrar organización" />}><X /></SheetClose>
        <QrNavigation {...props} onSelect={(group) => { props.onSelect(group); setMobileOpen(false); }} />
      </SheetContent>
    </Sheet>
  );
  return (
      <aside aria-label="Organización de QR" className={cn("hidden shrink-0 self-start rounded-lg border border-border bg-card p-2 lg:block", collapsed ? "w-12" : "w-[220px]")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          {!collapsed ? <span className="px-3 text-sm font-medium">Organizar</span> : null}
          <Button variant="ghost" size="icon-sm" aria-label={collapsed ? "Expandir organización" : "Contraer organización"} aria-expanded={!collapsed} aria-controls={id} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <div id={id} hidden={collapsed}><QrNavigation {...props} /></div>
      </aside>
  );
}
