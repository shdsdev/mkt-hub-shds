"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, Ellipsis, Pencil } from "lucide-react";
import type { EmailCampaign } from "@/modules/email-marketing";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { duplicateEmailCampaignAction } from "./campaigns/actions";

const statusLabels: Record<EmailCampaign["status"], string> = {
  draft: "Borrador",
  scheduled: "Programada",
  sending: "Enviando",
  sent: "Enviada",
  cancelled: "Cancelada",
  failed: "Fallida",
};

export function CampaignLibrary({ campaigns, segmentNames }: { campaigns: EmailCampaign[]; segmentNames: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EmailCampaign["status"] | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [selected, setSelected] = useState<string[]>([]);
  const filteredCampaigns = useMemo(
    () => campaigns
      .filter((campaign) => `${campaign.name} ${campaign.subject}`.toLowerCase().includes(query.trim().toLowerCase()))
      .filter((campaign) => status === "all" || campaign.status === status)
      .sort((a, b) => sort === "newest" ? b.updatedAt.getTime() - a.updatedAt.getTime() : a.updatedAt.getTime() - b.updatedAt.getTime()),
    [campaigns, query, sort, status],
  );
  const allVisibleSelected = filteredCampaigns.length > 0 && filteredCampaigns.every((campaign) => selected.includes(campaign.id));

  function toggleAll() {
    setSelected(allVisibleSelected ? selected.filter((id) => !filteredCampaigns.some((campaign) => campaign.id === id)) : Array.from(new Set([...selected, ...filteredCampaigns.map((campaign) => campaign.id)])));
  }

  function toggleCampaign(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span>Tipo: <strong className="font-medium text-foreground">Email</strong></span>
          <span>Estado:</span>
          <Select value={status} onValueChange={(value) => setStatus((value ?? "all") as typeof status)}>
            <SelectTrigger size="sm" className="w-auto border-0 bg-transparent px-0 text-xs text-primary shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <span>Carpeta: <strong className="font-medium text-primary">Todas</strong></span>
          <span>Fecha: <strong className="font-medium text-primary">Todas</strong></span>
          {selected.length > 0 ? <button type="button" onClick={() => setSelected([])} className="text-primary hover:underline">Borrar selección ({selected.length})</button> : null}
          <span className="ml-auto hidden sm:inline">Ordenar por:</span>
          <Select value={sort} onValueChange={(value) => setSort((value ?? "newest") as typeof sort)}>
            <SelectTrigger size="sm" className="w-auto border-0 bg-transparent px-0 text-xs text-primary shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Fecha de edición ↓</SelectItem><SelectItem value="oldest">Fecha de edición ↑</SelectItem></SelectContent>
          </Select>
        </div>
        <label className="block min-w-0 sm:max-w-lg">
          <span className="sr-only">Buscar campañas</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre o asunto" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
        </label>
      </div>
      {filteredCampaigns.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No encontramos campañas con esos filtros.</p>
      ) : (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="w-12 px-3 py-4"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Seleccionar todas las campañas" className="size-4 accent-primary" /></th>
                <th className="px-3 py-4 font-medium">Nombre</th>
                <th className="px-3 py-4 font-medium">Estado</th>
                <th className="px-3 py-4 font-medium">Público</th>
                <th className="px-3 py-4 font-medium">Análisis</th>
                <th className="px-3 py-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="group transition-colors hover:bg-muted/15">
                  <td className="px-3 py-5 align-top"><input type="checkbox" checked={selected.includes(campaign.id)} onChange={() => toggleCampaign(campaign.id)} aria-label={`Seleccionar ${campaign.name}`} className="mt-1 size-4 accent-primary" /></td>
                  <td className="max-w-[280px] px-3 py-5 align-top">
                    <Link href={`/email-marketing/campaigns/${campaign.id}`} className="block focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      <p className="truncate font-medium text-foreground hover:text-primary">{campaign.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">Correo electrónico ordinario</p>
                      <p className="mt-1 text-xs text-muted-foreground">Última edición {campaign.updatedAt.toLocaleDateString("es-MX")} por vos</p>
                    </Link>
                  </td>
                  <td className="px-3 py-5 align-top"><span className="inline-flex rounded border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">{statusLabels[campaign.status]}</span></td>
                  <td className="px-3 py-5 align-top"><Link href={`/email-marketing/campaigns/${campaign.id}`} className="text-primary hover:underline">{segmentNames[campaign.segmentId ?? ""] ?? (campaign.segmentId ? "Segmento no disponible" : "Todos los suscriptos")}</Link><p className="mt-1 text-xs text-muted-foreground">Destinatarios pendientes de envío</p></td>
                  <td className="px-3 py-5 align-top"><div className="grid grid-cols-3 gap-4 text-center text-xs text-muted-foreground"><span><strong className="block text-sm font-medium text-foreground">—</strong>Aperturas</span><span><strong className="block text-sm font-medium text-foreground">—</strong>Clics</span><span><strong className="block text-sm font-medium text-foreground">—</strong>Ingresos</span></div></td>
                  <td className="px-3 py-5 align-top"><div className="flex justify-end gap-2">
                    {campaign.status === "draft" ? <Link href={`/email-marketing/campaigns/${campaign.id}/edit`} aria-label={`Editar ${campaign.name}`} className="inline-flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Pencil size={13} /> Editar</Link> : null}
                    <form action={duplicateEmailCampaignAction}><input type="hidden" name="campaignId" value={campaign.id} /><button type="submit" aria-label={`Duplicar ${campaign.name}`} className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Copy size={14} /></button></form>
                    <Link href={`/email-marketing/campaigns/${campaign.id}`} aria-label={`Más acciones para ${campaign.name}`} className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Ellipsis size={16} /></Link>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-end gap-4 border-t border-border pt-5 text-xs text-muted-foreground">Mostrando resultados {filteredCampaigns.length === 0 ? "0" : `1-${filteredCampaigns.length}`} de {filteredCampaigns.length}<span>‹</span><span>Página <strong className="font-medium text-foreground">1</strong> de 1</span><span>›</span></div>
    </>
  );
}
