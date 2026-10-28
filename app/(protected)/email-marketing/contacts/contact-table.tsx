"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import type { EmailContact, EmailTag, EmailContactListOptions, EmailSegment } from "@/modules/email-marketing";
import { assignEmailTagsAction, sendEmailRepermissionAction, subscribeEmailContactsAction, type ContactActionState } from "./actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const initialState: ContactActionState = {};
const sourceLabels: Record<string, string> = { csv_import: "Importación CSV", manual: "Alta manual", event_registration: "Registro de evento" };
const columnLabels = { company: "Empresa", phone: "Teléfono", source: "Fuente", status: "Estado", updatedAt: "Actualizado" } as const;
type OptionalColumn = keyof typeof columnLabels;
const defaultColumns: Record<OptionalColumn, boolean> = { company: true, phone: false, source: false, status: true, updatedAt: true };

export function ContactTable({ contacts, total, page, pageSize, filter, tags, segments, statusLabels, onContactOpen }: { contacts: EmailContact[]; total: number; page: number; pageSize: number; filter: EmailContactListOptions; tags: EmailTag[]; segments: EmailSegment[]; statusLabels: Record<EmailContact["subscriptionStatus"], string>; onContactOpen: (contact: EmailContact) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tagId, setTagId] = useState("");
  const [assignState, assignAction, assignPending] = useActionState(assignEmailTagsAction, initialState);
  const [subscribeState, subscribeAction, subscribePending] = useActionState(subscribeEmailContactsAction, initialState);
  const [repermissionState, repermissionAction, repermissionPending] = useActionState(sendEmailRepermissionAction, initialState);
  const [columns, setColumns] = useState(defaultColumns);
  const [searchText, setSearchText] = useState(filter.search ?? "");
  const pendingSearch = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pushFilters = useCallback((values: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("email-marketing-contact-columns") ?? "null") as Partial<Record<OptionalColumn, boolean>> | null;
      if (saved) setColumns((current) => ({ ...current, ...saved }));
    } catch {
      // Ignore unavailable or invalid browser storage.
    }
  }, []);

  function toggleColumn(column: OptionalColumn) {
    setColumns((current) => {
      const next = { ...current, [column]: !current[column] };
      localStorage.setItem("email-marketing-contact-columns", JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    if (assignState.success || subscribeState.success || repermissionState.success) router.refresh();
  }, [router, assignState.success, subscribeState.success, repermissionState.success]);

  useEffect(() => {
    const serverSearch = filter.search ?? "";
    if (pendingSearch.current === serverSearch) {
      pendingSearch.current = null;
      return;
    }
    if (pendingSearch.current === null) setSearchText(serverSearch);
  }, [filter.search]);

  useEffect(() => {
    const currentSearch = filter.search ?? "";
    if (searchText === currentSearch) return;
    const nextSearch = searchText.trim();
    const timeout = window.setTimeout(() => {
      pendingSearch.current = nextSearch;
      pushFilters({ q: nextSearch || undefined });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [filter.search, pushFilters, searchText]);
  const visibleContacts = contacts;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = visibleContacts.length > 0 && visibleContacts.every((contact) => selected.includes(contact.id));

  function pushPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`${pathname}?${params}`);
  }

  function toggleAll() {
    setSelected(allSelected ? selected.filter((id) => !visibleContacts.some((contact) => contact.id === id)) : Array.from(new Set([...selected, ...visibleContacts.map((contact) => contact.id)])));
  }

  function toggleContact(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return (
     <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="flex flex-col gap-4 border-b border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground"><strong className="font-medium text-foreground">{total.toLocaleString("es-MX")}</strong> contactos en tu audiencia</p>
            <p className="text-xs text-muted-foreground">{contacts.length.toLocaleString("es-MX")} en esta página</p>
          </div>
           <div className="flex flex-wrap items-center gap-2">
            <label className="min-w-[220px] flex-1"><span className="sr-only">Buscar contactos</span><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar contactos" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
            <Select value={filter.segmentId ?? "all"} onValueChange={(value) => pushFilters({ segment: value === "all" ? undefined : value ?? undefined })}><SelectTrigger aria-label="Filtrar por segmento" className="h-11 w-full sm:w-auto"><SelectValue>{filter.segmentId ? segments.find((segment) => segment.id === filter.segmentId)?.name ?? "Segmento" : "Segmentos"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">Todos los segmentos</SelectItem>{segments.map((segment) => <SelectItem key={segment.id} value={segment.id}>{segment.name}</SelectItem>)}</SelectContent></Select>
            <Select value={filter.status ?? "all"} onValueChange={(value) => pushFilters({ status: value === "all" ? undefined : value ?? undefined })}><SelectTrigger aria-label="Filtrar por estado de suscripción" className="h-11 w-full sm:w-auto"><SelectValue>{filter.status ? statusLabels[filter.status] : "Estado de la suscripción"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={filter.tagId ?? "all"} onValueChange={(value) => pushFilters({ tag: value === "all" ? undefined : value ?? undefined })}><SelectTrigger aria-label="Filtrar por etiqueta" className="h-11 w-full sm:w-auto"><SelectValue>{filter.tagId ? tags.find((tag) => tag.id === filter.tagId)?.name ?? "Etiqueta" : "Etiquetas"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">Todas las etiquetas</SelectItem>{tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}</SelectContent></Select>
            <Select value={filter.source ?? "all"} onValueChange={(value) => pushFilters({ source: value === "all" ? undefined : value ?? undefined })}><SelectTrigger aria-label="Filtrar por fuente" className="h-11 w-full sm:w-auto"><SelectValue>{filter.source ? sourceLabels[filter.source] ?? filter.source : "Fuente de suscripción"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">Todas las fuentes</SelectItem>{Object.entries(sourceLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={filter.sort} onValueChange={(value) => pushFilters({ sort: value ?? "name_asc" })}><SelectTrigger aria-label="Ordenar contactos" className="h-11 w-full sm:w-auto"><SelectValue>{filter.sort === "name_desc" ? "Nombre Z-A" : filter.sort === "updated_desc" ? "Más recientes" : "Nombre A-Z"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="name_asc">Nombre A-Z</SelectItem><SelectItem value="name_desc">Nombre Z-A</SelectItem><SelectItem value="updated_desc">Más recientes</SelectItem></SelectContent></Select>
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Columns3 size={15} /> Columnas</button>} />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
                  {Object.entries(columnLabels).map(([column, label]) => <DropdownMenuCheckboxItem key={column} checked={columns[column as OptionalColumn]} onCheckedChange={() => toggleColumn(column as OptionalColumn)}>{label}</DropdownMenuCheckboxItem>)}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {filter.search || filter.status || filter.tagId || filter.segmentId || filter.source || filter.sort !== "name_asc" ? <button type="button" onClick={() => { pendingSearch.current = ""; setSearchText(""); pushFilters({ q: undefined, status: undefined, tag: undefined, segment: undefined, source: undefined, sort: undefined }); }} className="h-11 px-2 text-sm text-primary hover:underline">Limpiar filtros</button> : null}
          </div>
        </div>
      {selected.length > 0 ? <form action={assignAction} className="flex flex-wrap items-center gap-3 border-b border-primary/20 bg-primary/5 p-4">
        <input type="hidden" name="contactIds" value={JSON.stringify(selected)} />
        <input type="hidden" name="tagIds" value={JSON.stringify(tagId ? [tagId] : [])} />
        <span className="text-sm font-medium">{selected.length} {selected.length === 1 ? "contacto seleccionado" : "contactos seleccionados"}</span>
         <Select value={tagId} onValueChange={(value) => setTagId(value ?? "")}><SelectTrigger aria-label="Etiqueta para contactos seleccionados" className="h-10"><SelectValue placeholder="Elegí una etiqueta" /></SelectTrigger><SelectContent>{tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>)}</SelectContent></Select>
        <button type="submit" disabled={assignPending || !tagId} className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{assignPending ? "Asignando…" : "Asignar etiqueta"}</button>
        <button type="submit" formAction={subscribeAction} disabled={subscribePending} className="h-10 rounded-lg border border-primary/30 bg-background px-3 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50">{subscribePending ? "Suscribiendo…" : "Suscribir"}</button>
        <button type="submit" formAction={repermissionAction} disabled={repermissionPending || selected.length > 100} className="h-10 rounded-lg border border-accent/40 bg-background px-3 text-sm font-medium text-accent hover:bg-accent/5 disabled:opacity-50">{repermissionPending ? "Enviando…" : "Solicitar permiso"}</button>
        <button type="button" onClick={() => { setSelected([]); setTagId(""); }} className="h-10 rounded-lg px-3 text-sm text-muted-foreground hover:bg-background">Cancelar selección</button>
        {assignState.error ? <span role="alert" className="text-xs text-destructive">{assignState.error}</span> : null}
        {assignState.success ? <span role="status" className="text-xs text-accent">{assignState.success}</span> : null}
        {subscribeState.error ? <span role="alert" className="text-xs text-destructive">{subscribeState.error}</span> : null}
        {subscribeState.success ? <span role="status" className="text-xs text-accent">{subscribeState.success}</span> : null}
        {repermissionState.error ? <span role="alert" className="text-xs text-destructive">{repermissionState.error}</span> : null}
        {repermissionState.success ? <span role="status" className="text-xs text-accent">{repermissionState.success}</span> : null}
        {selected.length > 100 ? <span role="alert" className="text-xs text-destructive">Solicitá permiso en lotes de hasta 100 contactos.</span> : null}
      </form> : null}
      {total === 0 ? <div className="px-6 py-12 text-center text-sm text-muted-foreground">{filter.search ? `0 resultados para “${filter.search}”.` : filter.status ? "No encontramos contactos con esos filtros." : "Todavía no hay contactos."}</div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-background/30 text-xs text-muted-foreground"><tr><th className="w-12 px-5 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todos" /></th><th className="px-5 py-3 font-medium">Contacto</th>{columns.company ? <th className="px-5 py-3 font-medium">Empresa</th> : null}{columns.phone ? <th className="px-5 py-3 font-medium">Teléfono</th> : null}{columns.source ? <th className="px-5 py-3 font-medium">Fuente</th> : null}{columns.status ? <th className="px-5 py-3 font-medium">Estado</th> : null}{columns.updatedAt ? <th className="px-5 py-3 font-medium">Actualizado</th> : null}</tr></thead>
              <tbody className="divide-y divide-border/70">{visibleContacts.map((contact) => <tr key={contact.id} role="button" tabIndex={0} onClick={() => onContactOpen(contact)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onContactOpen(contact); } }} className="cursor-pointer hover:bg-muted/20 focus-visible:bg-muted/30 focus-visible:outline-none"><td className="px-5 py-4"><input type="checkbox" checked={selected.includes(contact.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleContact(contact.id)} aria-label={`Seleccionar ${contact.email}`} className="size-4 accent-primary" /></td><td className="px-5 py-4"><p className="font-medium">{contact.fullName || "Sin nombre"}</p><p className="mt-1 text-xs text-muted-foreground">{contact.email}</p></td>{columns.company ? <td className="px-5 py-4 text-muted-foreground">{contact.company || "--"}</td> : null}{columns.phone ? <td className="px-5 py-4 text-muted-foreground">{contact.phone || "--"}</td> : null}{columns.source ? <td className="px-5 py-4 text-muted-foreground">{sourceLabels[contact.source] ?? contact.source}</td> : null}{columns.status ? <td className="px-5 py-4"><span title={contact.subscriptionStatus === "pending" ? "No recibe campañas hasta contar con consentimiento." : undefined} className="rounded-full border border-border px-2.5 py-1 text-xs">{statusLabels[contact.subscriptionStatus]}</span></td> : null}{columns.updatedAt ? <td className="px-5 py-4 text-xs text-muted-foreground">{contact.updatedAt.toLocaleDateString("es-MX")}</td> : null}</tr>)}</tbody>
          </table>
        </div>
      )}
      {total > 0 ? <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} de {total.toLocaleString("es-MX")}</span><div className="flex items-center gap-2"><button type="button" onClick={() => pushPage(page - 1)} disabled={page === 1} aria-label="Página anterior" className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"><ChevronLeft size={15} /></button><span>Página {page} de {totalPages}</span><button type="button" onClick={() => pushPage(page + 1)} disabled={page === totalPages} aria-label="Página siguiente" className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40"><ChevronRight size={15} /></button></div></div> : null}
     </div>
  );
}
