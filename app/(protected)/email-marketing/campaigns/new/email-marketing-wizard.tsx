"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Code2,
  Columns2,
  Copy,
  Eye,
  GripVertical,
  Image,
  Mail,
  Minus,
  MousePointerClick,
  MoveVertical,
  Plus,
  Save,
  Settings2,
  Share2,
  Smartphone,
  SquareStack,
  Trash2,
  Type,
  Upload,
  Video,
} from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { createEmailCampaignAction, updateEmailCampaignAction, sendTestEmailAction, type CreateEmailCampaignFormState, type SendTestEmailFormState } from "../actions";
import { createEmailPreviewDocument, getEmailPreviewWidth } from "@/lib/email-source";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmailCampaign, EmailContentBlock } from "@/modules/email-marketing";

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type EditorBlockType =
  | "text"
  | "heading"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "logo"
  | "social"
  | "html"
  | "columns";
type PaletteBlockType = EditorBlockType | "video";

type BlockStyle = {
  align?: "left" | "center" | "right";
  backgroundColor?: string;
  color?: string;
  padding?: number;
};

type EditorBlock = {
  id: string;
  type: EditorBlockType;
  label: string;
  content: string;
  style: BlockStyle;
  href?: string;
  alt?: string;
  level?: "h1" | "h2" | "h3";
  height?: number;
  links?: Array<{ label: string; href: string }>;
  columnBlocks?: EditorBlock[][];
};

type DeviceMode = "desktop" | "mobile";
type PropertyTab = "content" | "styles" | "visibility" | "code";
type EditorDocument = { version: 1; mode: "blocks"; blocks: Array<Record<string, unknown>> };
type CampaignSendMode = "draft" | "now" | "scheduled";

const palette: Array<{ type: PaletteBlockType; label: string; description: string; icon: typeof Type }> = [
  { type: "image", label: "Imagen", description: "Añade una imagen", icon: Image },
  { type: "heading", label: "Encabezado", description: "Título de sección", icon: Type },
  { type: "text", label: "Párrafo", description: "Texto enriquecido", icon: Type },
  { type: "button", label: "Botón", description: "Llamada a la acción", icon: MousePointerClick },
  { type: "divider", label: "Divisor", description: "Separador visual", icon: Minus },
  { type: "spacer", label: "Espaciador", description: "Espacio vertical", icon: MoveVertical },
  { type: "video", label: "Video", description: "Enlace a video", icon: Video },
  { type: "social", label: "Redes sociales", description: "Enlaces sociales", icon: Share2 },
  { type: "logo", label: "Logotipo", description: "Identidad de marca", icon: SquareStack },
  { type: "html", label: "Código", description: "HTML personalizado", icon: Code2 },
];

const initialBlocks: EditorBlock[] = [
  {
    id: "heading-1",
    type: "heading",
    label: "Encabezado",
    content: "Hola {{first_name}}",
    level: "h1",
    style: { color: "#1d2430", padding: 8 },
  },
  {
    id: "text-1",
    type: "text",
    label: "Párrafo",
    content: "Tenemos algo nuevo para vos. Escribí aquí el mensaje principal de tu campaña.",
    style: { color: "#1d2430", padding: 8 },
  },
  {
    id: "button-1",
    type: "button",
    label: "Botón",
    content: "Conocé más",
    href: "https://example.com",
    style: { padding: 8 },
  },
];

const initialHtml = `<h1 style="margin:0 0 16px;color:#1d2430">Hola {{first_name}}</h1>\n<p style="margin:0 0 16px;line-height:1.6">Tenemos algo nuevo para vos.</p>\n<p><a href="https://example.com" style="display:inline-block;padding:12px 18px;background:#ff6f2c;color:#fff;text-decoration:none;border-radius:8px">Conocé más</a></p>`;

function createBlockId(type: EditorBlockType): string {
  return `${type}-${crypto.randomUUID()}`;
}

function createBlock(type: EditorBlockType, label: string): EditorBlock {
  const defaults: Record<EditorBlockType, Partial<EditorBlock>> = {
    text: { content: "Escribí el mensaje de tu campaña." },
    heading: { content: "Un encabezado memorable", level: "h2" },
    image: { content: "https://images.example.com/hero.jpg", alt: "Imagen de campaña" },
    button: { content: "Ver evento", href: "https://example.com" },
    divider: { content: "" },
    spacer: { content: "", height: 32 },
    logo: { content: "https://images.example.com/logo.png", alt: "Logotipo" },
    social: { content: "Instagram | LinkedIn", links: [{ label: "Instagram", href: "https://instagram.com" }, { label: "LinkedIn", href: "https://linkedin.com" }] },
    html: { content: "<p>HTML personalizado</p>" },
    columns: { content: "Columna uno | Columna dos" },
  };

  const defaultValues = defaults[type];
  const block: EditorBlock = {
    id: createBlockId(type),
    type,
    label,
    content: defaultValues.content ?? "",
    style: { color: "#1d2430", padding: 8 },
    ...defaultValues,
  };
  if (type === "columns") {
    block.columnBlocks = [[createBlock("text", "Párrafo")], [createBlock("text", "Párrafo")]];
  }
  return block;
}

function findEditorBlock(blocks: EditorBlock[], id: string): EditorBlock | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    const nested = block.columnBlocks ? findEditorBlock(block.columnBlocks.flat(), id) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function updateEditorBlock(blocks: EditorBlock[], id: string, changes: Partial<EditorBlock>): EditorBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return { ...block, ...changes };
    if (!block.columnBlocks) return block;
    return { ...block, columnBlocks: block.columnBlocks.map((column) => updateEditorBlock(column, id, changes)) };
  });
}

function blockToDocument(blocks: EditorBlock[]): EditorDocument {
  return {
    version: 1 as const,
    mode: "blocks" as const,
    blocks: blocks.map((block) => {
      switch (block.type) {
        case "text":
          return { id: block.id, type: block.type, text: block.content, style: block.style };
        case "heading":
          return { id: block.id, type: block.type, text: block.content, level: block.level ?? "h2", style: block.style };
        case "image":
          return { id: block.id, type: block.type, src: block.content, alt: block.alt ?? "", style: block.style };
        case "logo":
          return { id: block.id, type: block.type, src: block.content, alt: block.alt ?? "", style: block.style };
        case "button":
          return { id: block.id, type: block.type, label: block.content, href: block.href ?? "https://example.com", style: block.style };
        case "spacer":
          return { id: block.id, type: block.type, height: block.height ?? 32, style: block.style };
        case "social":
          return { id: block.id, type: block.type, links: block.links ?? [], style: block.style };
        case "html":
          return { id: block.id, type: block.type, html: block.content, style: block.style };
        case "columns":
          return {
            id: block.id,
            type: block.type,
            columns: block.columnBlocks?.map((column, index) => ({
              id: `${block.id}-column-${index + 1}`,
              blocks: blockToDocument(column).blocks,
            })) ?? block.content.split("|").map((column) => column.trim()),
            style: block.style,
          };
        case "divider":
          return { id: block.id, type: block.type, style: block.style };
      }
    }),
  };
}

function contentBlockToEditorBlock(block: EmailContentBlock): EditorBlock {
  const base = { id: block.id, type: block.type as EditorBlockType, label: block.type, content: "", style: block.style };
  switch (block.type) {
    case "text": return { ...base, label: "Párrafo", content: block.text };
    case "heading": return { ...base, label: "Encabezado", content: block.text, level: block.level };
    case "image": return { ...base, label: "Imagen", content: block.src, alt: block.alt };
    case "logo": return { ...base, label: "Logotipo", content: block.src, alt: block.alt };
    case "button": return { ...base, label: "Botón", content: block.label, href: block.href };
    case "spacer": return { ...base, label: "Espaciador", height: block.height };
    case "social": return { ...base, label: "Redes sociales", links: block.links };
    case "html": return { ...base, label: "Código", content: block.html };
    case "divider": return { ...base, label: "Divisor" };
    case "columns": return {
      ...base,
      label: "Columnas",
      content: block.columns.map((column) => typeof column === "string" ? column : "Columna").join(" | "),
      columnBlocks: block.columns.map((column) => typeof column === "string" ? [createBlock("text", "Párrafo")] : (column.blocks as EmailContentBlock[]).map(contentBlockToEditorBlock)),
    };
    case "variable": return { ...base, label: "Variable", content: `{{${block.name}}}` };
  }
}

type AudienceSegment = {
  id: string;
  name: string;
  definition: { filters: { tags?: string[]; eventIds?: string[]; subscriptionStatuses?: string[]; conditions?: unknown[] } };
  matchedContactCount: number;
  eligibleContactCount: number;
  excludedContactCount: number;
};

function audienceFilterLabels(segment: AudienceSegment): string[] {
  const filters = segment.definition.filters;
  const statusLabels: Record<string, string> = {
    subscribed: "Suscripto",
    pending: "Pendiente",
    unsubscribed: "Dado de baja",
    suppressed: "Suprimido",
  };
  return [
    filters.tags?.length ? `${filters.tags.length} ${filters.tags.length === 1 ? "etiqueta" : "etiquetas"}` : null,
    filters.eventIds?.length ? `${filters.eventIds.length} ${filters.eventIds.length === 1 ? "evento" : "eventos"}` : null,
    filters.subscriptionStatuses?.length ? `Estado: ${filters.subscriptionStatuses.map((status) => statusLabels[status] ?? status).join(", ")}` : null,
    filters.conditions?.length ? `${filters.conditions.length} ${filters.conditions.length === 1 ? "condición" : "condiciones"}` : null,
  ].filter((label): label is string => Boolean(label));
}

function AudienceSummary({ segment }: { segment: AudienceSegment }) {
  const filterLabels = audienceFilterLabels(segment);
  const hasNoEligibleContacts = segment.eligibleContactCount === 0;

  return (
    <div aria-live="polite" className={`mt-4 rounded-xl border p-4 ${hasNoEligibleContacts ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Audiencia seleccionada</p>
          <h3 className="mt-1 text-base font-semibold">{segment.name}</h3>
          <p className={`mt-1 text-sm font-medium ${hasNoEligibleContacts ? "text-destructive" : "text-foreground"}`}>
            {hasNoEligibleContacts ? "No hay contactos elegibles para enviar" : `${segment.eligibleContactCount} contactos recibirán este correo`}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Se congela al guardar</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-background/30 p-3"><p className="text-xs text-muted-foreground">Coinciden</p><p className="mt-1 text-lg font-semibold">{segment.matchedContactCount}</p></div>
        <div className="rounded-lg border border-border/70 bg-background/30 p-3"><p className="text-xs text-muted-foreground">Recibirán</p><p className="mt-1 text-lg font-semibold text-accent">{segment.eligibleContactCount}</p></div>
        <div className="rounded-lg border border-border/70 bg-background/30 p-3"><p className="text-xs text-muted-foreground">Excluidos</p><p className="mt-1 text-lg font-semibold">{segment.excludedContactCount}</p></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Las bajas, supresiones y contactos sin consentimiento quedan fuera automáticamente.</p>
      {filterLabels.length ? <div className="mt-3 flex flex-wrap gap-2">{filterLabels.map((label) => <span key={label} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{label}</span>)}</div> : null}
    </div>
  );
}

function campaignToEditorState(campaign?: EmailCampaign) {
  if (!campaign) return { blocks: initialBlocks, editorMode: "blocks" as const, htmlBody: initialHtml };
  if (campaign.content.mode === "html") return { blocks: initialBlocks, editorMode: "html" as const, htmlBody: campaign.content.bodyHtml };
  return { blocks: campaign.content.blocks.map(contentBlockToEditorBlock), editorMode: "blocks" as const, htmlBody: initialHtml };
}

function escapePreviewText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function EditorBlockPreview({ block, selectedId, onSelect, onAddNested }: { block: EditorBlock; selectedId?: string; onSelect?: (id: string) => void; onAddNested?: (blockId: string, columnIndex: number) => void }) {
  const style = {
    backgroundColor: block.style.backgroundColor,
    color: block.style.color,
    padding: block.style.padding,
    textAlign: block.style.align,
  } as React.CSSProperties;

  if (block.type === "heading") {
    const Heading = block.level ?? "h2";
    return <Heading style={style} className="m-0 text-2xl font-bold leading-tight">{block.content}</Heading>;
  }
  if (block.type === "text") return <p style={style} className="m-0 whitespace-pre-wrap text-sm leading-7">{block.content}</p>;
  if (block.type === "image" || block.type === "logo") {
    return <div style={style} className="rounded-lg bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={block.content} alt={block.alt ?? ""} className="mx-auto max-h-56 max-w-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />
    </div>;
  }
  if (block.type === "button") return <div style={style}><span className="inline-flex rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white">{block.content}</span></div>;
  if (block.type === "divider") return <div style={style}><hr className="border-slate-200" /></div>;
  if (block.type === "spacer") return <div style={{ ...style, height: block.height ?? 32 }} className="rounded bg-slate-100/60"><span className="sr-only">Espaciador</span></div>;
  if (block.type === "social") return <div style={style} className="flex flex-wrap gap-3 text-sm font-medium text-orange-600">{(block.links ?? []).map((link) => <span key={link.label}>{link.label}</span>)}</div>;
  if (block.type === "columns" && block.columnBlocks) return <div style={style} className="grid grid-cols-2 gap-3 text-sm">{block.columnBlocks.map((column, columnIndex) => <div key={`${block.id}-column-${columnIndex}`} className="min-h-20 rounded bg-slate-100 p-2">{column.map((nestedBlock) => <div key={nestedBlock.id} role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onSelect?.(nestedBlock.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onSelect?.(nestedBlock.id); } }} className={`rounded p-2 ${selectedId === nestedBlock.id ? "outline outline-2 outline-cyan-500" : "hover:bg-white/70"}`}><EditorBlockPreview block={nestedBlock} selectedId={selectedId} onSelect={onSelect} /></div>)}<button type="button" onClick={(event) => { event.stopPropagation(); onAddNested?.(block.id, columnIndex); }} className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-slate-300 py-2 text-xs text-slate-500 hover:border-cyan-500 hover:text-cyan-600"><Plus size={13} /> Agregar bloque</button></div>)}</div>;
  if (block.type === "columns") return <div style={style} className="grid grid-cols-2 gap-3 text-sm">{block.content.split("|").map((column) => <span key={column} className="rounded bg-slate-100 p-4">{column.trim()}</span>)}</div>;
  return <div style={style} className="rounded border border-dashed border-orange-300 bg-orange-50 p-4 font-mono text-xs text-slate-600">{escapePreviewText(block.content)}</div>;
}

function EmailBlockCanvas({
  blocks,
  selectedId,
  device,
  onSelect,
  onDropBlock,
  onAddNested,
}: {
  blocks: EditorBlock[];
  selectedId: string;
  device: DeviceMode;
  onSelect: (id: string) => void;
  onDropBlock: (sourceId: string, targetId: string) => void;
  onAddNested: (blockId: string, columnIndex: number) => void;
}) {
  return (
    <div
      className="bg-[#e9edf2] p-4 sm:p-8 lg:p-10"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId) onDropBlock(sourceId, blocks.at(-1)?.id ?? "");
      }}
    >
      <div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-xl shadow-black/10 transition-[width] ${device === "mobile" ? "w-[390px] max-w-full" : "w-full max-w-[760px]"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><span className="font-semibold text-slate-900">Marketing Hub</span><Mail size={16} className="text-orange-500" /></div>
        <div className="space-y-2 p-6 text-slate-800">
          {blocks.map((block) => (
            <div
              key={block.id}
              draggable
              role="button"
              tabIndex={0}
              aria-label={`Editar bloque ${block.label}`}
              onClick={() => onSelect(block.id)}
              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.id); }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const sourceId = event.dataTransfer.getData("text/plain"); if (sourceId) onDropBlock(sourceId, block.id); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(block.id); } }}
              className={`group relative cursor-pointer rounded-lg text-left transition ${selectedId === block.id ? "outline outline-2 outline-cyan-500 outline-offset-2" : "hover:bg-slate-50"}`}
            >
              <div className="pointer-events-none absolute -left-5 top-1/2 z-10 -translate-y-1/2 text-slate-400 opacity-0 transition group-hover:opacity-100"><GripVertical size={16} /></div>
              <EditorBlockPreview block={block} selectedId={selectedId} onSelect={onSelect} onAddNested={onAddNested} />
              <span className="pointer-events-none absolute -right-1 -top-5 hidden rounded bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white group-hover:block">{block.label}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400">Enviado desde Marketing Hub · Darse de baja</div>
      </div>
    </div>
  );
}

function HtmlPreview({ source, device }: { source: string; device: DeviceMode }) {
  const [height, setHeight] = useState(240);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  function resizeToDocument(frame: HTMLIFrameElement) {
    observerRef.current?.disconnect();
    const document = frame.contentDocument;
    if (!document) return;
    const measure = () => setHeight(Math.max(240, document.body?.scrollHeight ?? document.documentElement.scrollHeight));
    measure();
    observerRef.current = new ResizeObserver(measure);
    observerRef.current.observe(document.documentElement);
    if (document.body) observerRef.current.observe(document.body);
  }

  return <iframe title="Vista previa del email HTML" sandbox="allow-same-origin" srcDoc={createEmailPreviewDocument(source)} onLoad={(event) => resizeToDocument(event.currentTarget)} scrolling="no" style={{ width: getEmailPreviewWidth(device), height, overflow: "hidden" }} className="mx-auto block max-w-full border-0" />;
}

function CampaignMetaFields({
  name,
  subject,
  previewText,
  fromName,
  sendMode,
  scheduledAt,
  minimumScheduledAt,
  onNameChange,
  onSubjectChange,
  onPreviewTextChange,
  onFromNameChange,
  onSendModeChange,
  onScheduledAtChange,
}: {
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  sendMode: CampaignSendMode;
  scheduledAt: string;
  minimumScheduledAt: string;
  onNameChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onPreviewTextChange: (value: string) => void;
  onFromNameChange: (value: string) => void;
  onSendModeChange: (value: CampaignSendMode) => void;
  onScheduledAtChange: (value: string) => void;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2 sm:p-5">
      <label className="block text-sm font-medium">Nombre de campaña<input value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={255} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      <label className="block text-sm font-medium">Asunto<input value={subject} onChange={(event) => onSubjectChange(event.target.value)} maxLength={255} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      <label className="block text-sm font-medium">Texto de vista previa<input value={previewText} onChange={(event) => onPreviewTextChange(event.target.value)} maxLength={255} placeholder="La primera línea que verá tu audiencia" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      <label className="block text-sm font-medium">Nombre del remitente<input value={fromName} onChange={(event) => onFromNameChange(event.target.value)} maxLength={120} placeholder="Shades + Spaces" className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      <label className="block text-sm font-medium">Entrega<Select value={sendMode} onValueChange={(value) => onSendModeChange(value as CampaignSendMode)}><SelectTrigger className="mt-1.5 h-10 w-full"><SelectValue>{sendMode === "draft" ? "Guardar como borrador" : sendMode === "now" ? "Enviar ahora" : "Programar envío"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="draft">Guardar como borrador</SelectItem><SelectItem value="now">Enviar ahora</SelectItem><SelectItem value="scheduled">Programar envío</SelectItem></SelectContent></Select></label>
      {sendMode === "scheduled" ? <label className="block text-sm font-medium">Fecha y hora<input type="datetime-local" value={scheduledAt} min={minimumScheduledAt} onChange={(event) => onScheduledAtChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label> : <p className="self-end text-xs leading-5 text-muted-foreground">{sendMode === "now" ? "Al confirmar, la campaña quedará en cola para envío." : "El contenido y la audiencia se guardarán como borrador."}</p>}
    </section>
  );
}

function BlockPropertiesPanel({
  block,
  tab,
  onTabChange,
  onUpdate,
  onMove,
  onDuplicate,
  onRemove,
  onSelect,
  onAddNested,
  canRemove,
}: {
  block?: EditorBlock;
  tab: PropertyTab;
  onTabChange: (tab: PropertyTab) => void;
  onUpdate: (changes: Partial<EditorBlock>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSelect: (id: string) => void;
  onAddNested: (blockId: string, columnIndex: number) => void;
  canRemove: boolean;
}) {
  if (!block) return <div className="flex min-h-80 items-center justify-center text-center text-sm text-muted-foreground">Seleccioná un bloque para editarlo.</div>;

  const tabs: Array<[PropertyTab, string, typeof Settings2]> = [["content", "Contenido", Settings2], ["styles", "Estilos", Settings2], ["visibility", "Visibilidad", Eye], ["code", "Código", Code2]];
  /*
  if (activeStep === "schedule" || activeStep === "review") {
    return (
      <div>
        <form action={formAction} className="flex min-h-[calc(100svh-7rem)] w-full min-w-0 flex-col gap-5 overflow-hidden px-4 pb-6 sm:px-6">
          <input type="hidden" name="name" value={campaignName} />
          {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="previewText" value={previewText} />
          <input type="hidden" name="fromName" value={fromName} />
          <input type="hidden" name="sendMode" value={sendMode} />
          <input type="hidden" name="scheduledAt" value={scheduledAtIso} />
          <input type="hidden" name="content" value={JSON.stringify(contentDocument)} readOnly />
          <input type="hidden" name="audience" value={JSON.stringify(audienceDocument)} readOnly />
          <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Campaign studio</p><h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{campaign ? `Editar ${campaign.name}` : "Nueva campaña"}</h1><p className="mt-2 text-sm text-muted-foreground">Confirmá la entrega antes de guardar o enviar.</p></div>
              <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-accent" /> Borrador guardado</span>
            </div>
            <nav aria-label="Pasos de la campaña" className="grid gap-2 sm:grid-cols-4">{([['audience', 'Audiencia'], ['content', 'Contenido'], ['schedule', 'Programación'], ['review', 'Revisión']] as const).map(([value, label], index) => <button key={value} type="button" onClick={() => setActiveStep(value)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs ${activeStep === value ? "border-primary/70 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}><span className="font-mono text-[10px] text-primary">0{index + 1}</span>{label}</button>)}</nav>
          </header>
          <CampaignMetaFields name={campaignName} subject={subject} previewText={previewText} fromName={fromName} sendMode={sendMode} scheduledAt={scheduledAt} minimumScheduledAt={minimumScheduledAt} onNameChange={setCampaignName} onSubjectChange={setSubject} onPreviewTextChange={setPreviewText} onFromNameChange={setFromName} onSendModeChange={setSendMode} onScheduledAtChange={setScheduledAt} />
          {selectedAudience ? <AudienceSummary segment={selectedAudience} /> : null}
          {activeStep === "schedule" ? <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Programación</p><h2 className="mt-2 font-heading text-2xl font-semibold">¿Cuándo querés entregar este correo?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Elegí enviar ahora para poner la campaña en la cola de entrega o seleccioná una fecha futura. Guardar como borrador nunca envía correos.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><button type="button" onClick={() => setSendMode("draft")} className={`rounded-xl border p-4 text-left ${sendMode === "draft" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Guardar borrador</p><p className="mt-1 text-xs text-muted-foreground">No se envía.</p></button><button type="button" onClick={() => setSendMode("now")} className={`rounded-xl border p-4 text-left ${sendMode === "now" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Enviar ahora</p><p className="mt-1 text-xs text-muted-foreground">Se procesa al confirmar.</p></button><button type="button" onClick={() => setSendMode("scheduled")} className={`rounded-xl border p-4 text-left ${sendMode === "scheduled" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Programar</p><p className="mt-1 text-xs text-muted-foreground">Elegí una fecha futura.</p></button></div>{sendMode === "scheduled" ? <label className="mt-5 block max-w-md text-sm font-medium">Fecha y hora<input type="datetime-local" value={scheduledAt} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} onChange={(event) => setScheduledAt(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label> : null}</section> : <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Revisión</p><h2 className="mt-2 font-heading text-2xl font-semibold">Confirmá antes de enviar</h2><div className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Audiencia</p><p className="font-medium">{audienceMode === "segment" ? selectedSegment?.name ?? "Segmento seleccionado" : "Todos los suscriptos"}</p><p className="text-xs text-muted-foreground">{selectedAudienceCount} destinatarios elegibles</p></div><div><p className="text-xs text-muted-foreground">Entrega</p><p className="font-medium">{sendMode === "draft" ? "Guardar borrador" : sendMode === "now" ? "Enviar ahora" : scheduledAt ? new Date(scheduledAt).toLocaleString("es-MX") : "Elegí una fecha"}</p></div><div><p className="text-xs text-muted-foreground">Asunto</p><p className="font-medium">{subject || "Sin asunto"}</p></div><div><p className="text-xs text-muted-foreground">Remitente</p><p className="font-medium">{fromName || "Shades + Spaces"}</p></div></div>{sendMode !== "draft" && selectedAudienceCount === 0 ? <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">No hay destinatarios elegibles. Revisá el estado de suscripción de tus contactos antes de enviar.</p> : null}</section>}
          <footer className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><p className="text-xs text-muted-foreground">{selectedAudienceCount} destinatarios elegibles</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setActiveStep(activeStep === "schedule" ? "content" : "schedule")} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">{activeStep === "schedule" ? "Volver al contenido" : "Volver a programación"}</button><button type="submit" disabled={pending || (sendMode !== "draft" && (selectedAudienceCount === 0 || (sendMode === "scheduled" && !scheduledAt)))} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50">{pending ? "Procesando…" : sendMode === "draft" ? "Guardar borrador" : sendMode === "now" ? `Enviar a ${selectedAudienceCount}` : "Programar envío"}</button></div>{state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}{state.success ? <p role="status" className="text-xs text-accent">{state.success}</p> : null}</footer>
        </form>
      </div>
    );
  }
  */

  return (
    <div>
      <div className="flex border-b border-border" role="tablist" aria-label="Propiedades del bloque">
        {tabs.map(([value, label, Icon]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => onTabChange(value)} className={`flex-1 px-1 py-3 text-[11px] font-medium ${tab === value ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}><Icon size={14} className="mx-auto mb-1" />{label}</button>)}
      </div>
      <div className="space-y-4 p-4">
        {tab === "content" && <>
          <label className="block text-sm font-medium">Tipo<input value={block.label} readOnly className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background/50 px-3 text-sm text-muted-foreground" /></label>
          {block.type === "columns" && <div className="space-y-3"><p className="text-xs leading-5 text-muted-foreground">Cada columna es un contenedor independiente. Seleccioná un bloque para editarlo o agregá uno nuevo.</p>{(block.columnBlocks ?? []).map((column, columnIndex) => <div key={`${block.id}-properties-column-${columnIndex}`} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between text-xs font-semibold"><span>Columna {columnIndex + 1}</span><button type="button" onClick={() => onAddNested(block.id, columnIndex)} className="inline-flex items-center gap-1 text-primary hover:underline"><Plus size={13} /> Agregar</button></div><div className="mt-2 grid gap-1.5">{column.map((nestedBlock) => <button key={nestedBlock.id} type="button" onClick={() => onSelect(nestedBlock.id)} className="flex items-center justify-between rounded border border-border bg-background/50 px-2.5 py-2 text-left text-xs hover:border-primary/50"><span>{nestedBlock.label}</span><ChevronDown size={13} className="rotate-[-90deg] text-muted-foreground" /></button>)}</div></div>)}</div>}
          {(block.type === "text" || block.type === "heading" || block.type === "button" || block.type === "html" || block.type === "columns" || block.type === "social") && <label className="block text-sm font-medium">Contenido<textarea value={block.content} onChange={(event) => onUpdate({ content: event.target.value })} rows={block.type === "html" ? 12 : 5} className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></label>}
          {(block.type === "image" || block.type === "logo") && <>
            <label className="block text-sm font-medium">URL de imagen<input value={block.content} onChange={(event) => onUpdate({ content: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background/50 px-3 text-sm" /></label>
            <label className="block text-sm font-medium">Texto alternativo<input value={block.alt ?? ""} onChange={(event) => onUpdate({ alt: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background/50 px-3 text-sm" /></label>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"><Upload size={14} /> Subir imagen</button>
          </>}
          {block.type === "button" && <label className="block text-sm font-medium">Enlace<input value={block.href ?? ""} onChange={(event) => onUpdate({ href: event.target.value })} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background/50 px-3 text-sm" /></label>}
           {block.type === "heading" && <label className="block text-sm font-medium">Nivel<Select value={block.level ?? "h2"} onValueChange={(value) => onUpdate({ level: value as EditorBlock["level"] })}><SelectTrigger className="mt-1.5 h-9 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="h1">H1</SelectItem><SelectItem value="h2">H2</SelectItem><SelectItem value="h3">H3</SelectItem></SelectContent></Select></label>}
          {block.type === "spacer" && <label className="block text-sm font-medium">Altura<input type="number" min={4} max={240} value={block.height ?? 32} onChange={(event) => onUpdate({ height: Number(event.target.value) })} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background/50 px-3 text-sm" /></label>}
        </>}
          {tab === "styles" && <>
          <label className="block text-sm font-medium">Alineación<div className="mt-1.5 flex rounded-lg border border-border p-1">{([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([align, Icon]) => <button key={align} type="button" aria-label={align} onClick={() => onUpdate({ style: { ...block.style, align } })} className={`flex-1 rounded p-2 ${block.style.align === align ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><Icon size={15} className="mx-auto" /></button>)}</div></label>
          <label className="block text-sm font-medium">Color de fondo<input type="color" value={block.style.backgroundColor ?? "#ffffff"} onChange={(event) => onUpdate({ style: { ...block.style, backgroundColor: event.target.value } })} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background p-1" /></label>
          <label className="block text-sm font-medium">Color del texto<input type="color" value={block.style.color ?? "#1d2430"} onChange={(event) => onUpdate({ style: { ...block.style, color: event.target.value } })} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background p-1" /></label>
          <label className="block text-sm font-medium">Relleno <span className="font-normal text-muted-foreground">{block.style.padding ?? 0}px</span><input type="range" min={0} max={96} value={block.style.padding ?? 0} onChange={(event) => onUpdate({ style: { ...block.style, padding: Number(event.target.value) } })} className="mt-3 w-full accent-primary" /></label>
        </>}
        {tab === "visibility" && <div className="space-y-3"><p className="text-xs leading-5 text-muted-foreground">Controlá dónde aparece este bloque. El editor mantiene el contenido, solo cambia la visibilidad de la presentación.</p><label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span className="flex items-center gap-2"><Eye size={15} /> Escritorio</span><input type="checkbox" defaultChecked className="size-4 accent-primary" /></label><label className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span className="flex items-center gap-2"><Smartphone size={15} /> Móvil</span><input type="checkbox" defaultChecked className="size-4 accent-primary" /></label></div>}
        {tab === "code" && <div className="space-y-3"><p className="text-xs leading-5 text-muted-foreground">El HTML personalizado se sanitiza antes de guardarse.</p><textarea value={block.type === "html" ? block.content : JSON.stringify(block, null, 2)} readOnly={block.type !== "html"} onChange={(event) => block.type === "html" && onUpdate({ content: event.target.value })} rows={16} className="w-full resize-y rounded-lg border border-border bg-[#11161c] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></div>}
        <div className="grid grid-cols-4 gap-2 border-t border-border pt-4">
          <button type="button" onClick={() => onMove(-1)} title="Mover bloque hacia arriba" aria-label="Mover bloque hacia arriba" className="inline-flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/30"><ChevronUp size={17} /></button>
          <button type="button" onClick={() => onMove(1)} title="Mover bloque hacia abajo" aria-label="Mover bloque hacia abajo" className="inline-flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/30"><ChevronDown size={17} /></button>
          <button type="button" onClick={onDuplicate} title="Duplicar bloque" aria-label="Duplicar bloque" className="inline-flex size-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent/30"><Copy size={16} /></button>
          <button type="button" onClick={onRemove} disabled={!canRemove} title="Eliminar bloque" aria-label="Eliminar bloque" className="inline-flex size-10 items-center justify-center rounded-xl bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-destructive/30 disabled:pointer-events-none disabled:opacity-35"><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  );
}

export function EmailMarketingWizard({
  segments,
  eligibleContactCount,
  campaign,
}: {
  segments: AudienceSegment[];
  eligibleContactCount: number;
  campaign?: EmailCampaign;
}) {
  const [state, formAction, pending] = useActionState<CreateEmailCampaignFormState, FormData>(campaign ? updateEmailCampaignAction : createEmailCampaignAction, {});
  const [testState, testFormAction, testPending] = useActionState<SendTestEmailFormState, FormData>(sendTestEmailAction, {});
  const [activeStep, setActiveStep] = useState<"audience" | "content" | "schedule" | "review">("audience");
  const initialEditorState = campaignToEditorState(campaign);
  const [editorMode, setEditorMode] = useState<"blocks" | "html">(initialEditorState.editorMode);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [blocks, setBlocks] = useState(initialEditorState.blocks);
  const [htmlBody, setHtmlBody] = useState(initialEditorState.htmlBody);
  const [selectedId, setSelectedId] = useState(initialEditorState.blocks[0]?.id ?? "");
  const [propertyTab, setPropertyTab] = useState<PropertyTab>("content");
  const [feedback, setFeedback] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [audienceMode, setAudienceMode] = useState<"all" | "segment">(campaign?.segmentId ? "segment" : "all");
  const [selectedSegmentId, setSelectedSegmentId] = useState(campaign?.segmentId ?? "");
  const [campaignName, setCampaignName] = useState(campaign?.name ?? "Nueva campaña");
  const [subject, setSubject] = useState(campaign?.subject ?? "Tu próxima novedad");
  const [previewText, setPreviewText] = useState(campaign?.previewText ?? "");
  const [fromName, setFromName] = useState(campaign?.fromName ?? "Shades de México");
  const [sendMode, setSendMode] = useState<CampaignSendMode>(campaign?.status === "scheduled" ? "scheduled" : "draft");
  const [scheduledAt, setScheduledAt] = useState(campaign?.scheduledAt ? toLocalDateTimeInputValue(campaign.scheduledAt) : "");
  const [minimumScheduledAt] = useState(() => toLocalDateTimeInputValue(new Date(Date.now() + 60000)));

  useEffect(() => {
    if (testState.success) setShowTestEmail(false);
  }, [testState.success]);

  const selectedBlock = findEditorBlock(blocks, selectedId);
  const contentDocument = editorMode === "html" ? { version: 1 as const, mode: "html" as const, bodyHtml: htmlBody } : blockToDocument(blocks);
  const scheduledAtIso = scheduledAt ? new Date(scheduledAt).toISOString() : "";
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId || segment.name === selectedSegmentId);
  const audienceDocument = { mode: audienceMode, ...(audienceMode === "segment" && selectedSegment ? { segmentId: selectedSegment.id } : {}) };
  const selectedAudience = audienceMode === "segment" ? selectedSegment : undefined;
  const selectedAudienceCount = selectedAudience?.eligibleContactCount ?? eligibleContactCount;

  useEffect(() => {
    if (selectedSegment && selectedSegmentId === selectedSegment.id) setSelectedSegmentId(selectedSegment.name);
  }, [selectedSegment, selectedSegmentId]);

  function continueWizard() {
    if (activeStep === "audience" && audienceMode === "segment" && !selectedSegmentId) {
      setFeedback("Seleccioná un segmento para continuar.");
      return;
    }
    if (activeStep === "audience" && selectedAudienceCount === 0) {
      setFeedback("La audiencia no tiene contactos elegibles para enviar.");
      return;
    }
    setFeedback("");
    setActiveStep((current) => current === "audience" ? "content" : current === "content" ? "schedule" : current === "schedule" ? "review" : "review");
  }

  function addBlock(type: PaletteBlockType, label: string) {
    const block = createBlock(type === "video" ? "html" : type, label);
    setBlocks((current) => [...current, block]);
    setSelectedId(block.id);
    setPropertyTab("content");
  }

  function updateSelected(changes: Partial<EditorBlock>) {
    setBlocks((current) => updateEditorBlock(current, selectedId, changes));
  }

  function addNestedBlock(blockId: string, columnIndex: number) {
    const parent = findEditorBlock(blocks, blockId);
    if (!parent || parent.type !== "columns") return;
    const nested = createBlock("text", "Párrafo");
    const columnBlocks = parent.columnBlocks ?? [[], []];
    const nextColumns = columnBlocks.map((column, index) => index === columnIndex ? [...column, nested] : column);
    setBlocks((current) => updateEditorBlock(current, blockId, { columnBlocks: nextColumns }));
    setSelectedId(nested.id);
    setPropertyTab("content");
  }

  function moveSelected(direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === selectedId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setBlocks(next);
  }

  function duplicateSelected() {
    if (!selectedBlock) return;
    const duplicate = { ...selectedBlock, id: createBlockId(selectedBlock.type), links: selectedBlock.links?.map((link) => ({ ...link })) };
    const index = blocks.findIndex((block) => block.id === selectedId);
    if (index < 0) return;
    setBlocks((current) => [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)]);
    setSelectedId(duplicate.id);
  }

  function removeSelected() {
    if (!selectedBlock || blocks.length === 1) return;
    const index = blocks.findIndex((block) => block.id === selectedId);
    if (index < 0) return;
    const next = blocks.filter((block) => block.id !== selectedId);
    setBlocks(next);
    setSelectedId(next[Math.max(0, index - 1)]?.id ?? next[0].id);
  }

  function dropBlock(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const sourceIndex = blocks.findIndex((block) => block.id === sourceId);
    const targetIndex = blocks.findIndex((block) => block.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...blocks];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setBlocks(next);
    setSelectedId(sourceId);
  }

  if (activeStep === "schedule" || activeStep === "review") {
    const deliveryLabel = sendMode === "draft" ? "Guardar borrador" : sendMode === "now" ? "Enviar ahora" : "Programar envío";
    const scheduleIsFuture = Boolean(scheduledAt) && scheduledAt >= minimumScheduledAt;
    const canSubmit = sendMode === "draft" || (selectedAudienceCount > 0 && (sendMode === "now" || (sendMode === "scheduled" && scheduleIsFuture)));
    return (
      <div className="px-4 pb-6 sm:px-6">
        <form action={formAction} className="mx-auto flex max-w-5xl flex-col gap-5">
          <input type="hidden" name="name" value={campaignName} />
          {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="previewText" value={previewText} />
          <input type="hidden" name="fromName" value={fromName} />
          <input type="hidden" name="sendMode" value={sendMode} />
          <input type="hidden" name="scheduledAt" value={scheduledAtIso} />
          <input type="hidden" name="content" value={JSON.stringify(contentDocument)} readOnly />
          <input type="hidden" name="audience" value={JSON.stringify(audienceDocument)} readOnly />
          <header className="rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Campaign studio</p>
            <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{campaign ? `Editar ${campaign.name}` : "Nueva campaña"}</h1>
            <nav aria-label="Pasos de la campaña" className="mt-5 grid gap-2 sm:grid-cols-4">{([['audience', 'Audiencia'], ['content', 'Contenido'], ['schedule', 'Programación'], ['review', 'Revisión']] as const).map(([value, label], index) => <button key={value} type="button" onClick={() => setActiveStep(value)} className={`rounded-lg border px-3 py-2 text-left text-xs ${activeStep === value ? "border-primary/70 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}><span className="mr-2 font-mono text-[10px] text-primary">0{index + 1}</span>{label}</button>)}</nav>
          </header>
          <CampaignMetaFields name={campaignName} subject={subject} previewText={previewText} fromName={fromName} sendMode={sendMode} scheduledAt={scheduledAt} minimumScheduledAt={minimumScheduledAt} onNameChange={setCampaignName} onSubjectChange={setSubject} onPreviewTextChange={setPreviewText} onFromNameChange={setFromName} onSendModeChange={setSendMode} onScheduledAtChange={setScheduledAt} />
          {activeStep === "schedule" ? <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Programación</p><h2 className="mt-2 font-heading text-2xl font-semibold">¿Cuándo querés entregar este correo?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Guardar borrador no envía. Elegí una opción para preparar la entrega.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><button type="button" onClick={() => setSendMode("draft")} className={`rounded-xl border p-4 text-left ${sendMode === "draft" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Guardar borrador</p><p className="mt-1 text-xs text-muted-foreground">No se envía.</p></button><button type="button" onClick={() => setSendMode("now")} className={`rounded-xl border p-4 text-left ${sendMode === "now" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Enviar ahora</p><p className="mt-1 text-xs text-muted-foreground">Se pone en cola al confirmar.</p></button><button type="button" onClick={() => setSendMode("scheduled")} className={`rounded-xl border p-4 text-left ${sendMode === "scheduled" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Programar envío</p><p className="mt-1 text-xs text-muted-foreground">Elegí una fecha futura.</p></button></div>{sendMode === "scheduled" ? <label className="mt-5 block max-w-md text-sm font-medium">Fecha y hora<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} min={minimumScheduledAt} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label> : null}</section> : <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Revisión</p><h2 className="mt-2 font-heading text-2xl font-semibold">Confirmá antes de enviar</h2><div className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Audiencia</p><p className="font-medium">{audienceMode === "segment" ? selectedSegment?.name ?? "Segmento seleccionado" : "Todos los suscriptos"}</p><p className="text-xs text-muted-foreground">{selectedAudienceCount} destinatarios elegibles</p></div><div><p className="text-xs text-muted-foreground">Entrega</p><p className="font-medium">{sendMode === "scheduled" && scheduledAt ? new Date(scheduledAt).toLocaleString("es-MX") : deliveryLabel}</p></div><div><p className="text-xs text-muted-foreground">Asunto</p><p className="font-medium">{subject || "Sin asunto"}</p></div><div><p className="text-xs text-muted-foreground">Remitente</p><p className="font-medium">{fromName || "Shades + Spaces"}</p></div></div>{sendMode !== "draft" && selectedAudienceCount === 0 ? <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">No hay destinatarios suscriptos elegibles. Los contactos pendientes no pueden recibir campañas hasta registrar consentimiento.</p> : null}</section>}
          <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-4"><p className="text-xs text-muted-foreground">{selectedAudienceCount} destinatarios elegibles</p><div className="flex gap-2"><button type="button" onClick={() => setActiveStep(activeStep === "schedule" ? "content" : "schedule")} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">{activeStep === "schedule" ? "Volver al contenido" : "Volver a programación"}</button><button type="submit" disabled={pending || !canSubmit} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50">{pending ? "Procesando…" : deliveryLabel}</button></div>{sendMode === "scheduled" && !scheduleIsFuture ? <p role="alert" className="w-full text-xs text-destructive">Elegí una fecha y hora futuras para programar el envío.</p> : null}{state.error ? <p role="alert" className="w-full text-xs text-destructive">{state.error}</p> : null}{state.success ? <p role="status" className="w-full text-xs text-accent">{state.success}</p> : null}</footer>
        </form>
      </div>
    );
  }

  return (
    <div>
    <form action={formAction} className="flex min-h-[calc(100svh-7rem)] w-full min-w-0 flex-col gap-5 overflow-hidden px-4 pb-6 sm:px-6">
      <input type="hidden" name="name" value={campaignName} />
      {campaign ? <input type="hidden" name="campaignId" value={campaign.id} /> : null}
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="previewText" value={previewText} />
      <input type="hidden" name="fromName" value={fromName} />
      <input type="hidden" name="sendMode" value={sendMode} />
      <input type="hidden" name="scheduledAt" value={scheduledAtIso} />
      <input type="hidden" name="content" value={JSON.stringify(contentDocument)} readOnly />
      <input type="hidden" name="audience" value={JSON.stringify(audienceDocument)} readOnly />
      <input type="hidden" name="audienceCount" value={selectedAudienceCount} readOnly />
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Campaign studio</p><h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{campaign ? `Editar ${campaign.name}` : "Nueva campaña"}</h1><p className="mt-2 text-sm text-muted-foreground">Diseñá el email con bloques o HTML, revisá la audiencia y programá el envío.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setShowPreview(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"><Eye size={14} /> Vista previa</button><button type="button" onClick={() => setShowTestEmail(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 text-xs font-medium text-primary hover:bg-primary/10"><Mail size={14} /> Enviar prueba</button><span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-accent" /> {campaign ? "Borrador guardado" : "Borrador local"}</span></div></div>
        <nav aria-label="Pasos de la campaña" className="grid gap-2 sm:grid-cols-4">{([["audience", "Audiencia"], ["content", "Contenido"], ["schedule", "Programación"], ["review", "Revisión"]] as const).map(([value, label], index) => <button key={value} type="button" onClick={() => setActiveStep(value)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${activeStep === value ? "border-primary/70 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}><span className="font-mono text-[10px] text-primary">0{index + 1}</span>{label}</button>)}</nav>
       </header>

       <CampaignMetaFields name={campaignName} subject={subject} previewText={previewText} fromName={fromName} sendMode={sendMode} scheduledAt={scheduledAt} minimumScheduledAt={minimumScheduledAt} onNameChange={setCampaignName} onSubjectChange={setSubject} onPreviewTextChange={setPreviewText} onFromNameChange={setFromName} onSendModeChange={setSendMode} onScheduledAtChange={setScheduledAt} />

        {activeStep === "content" ? <section className="grid min-w-0 items-start gap-4 overflow-hidden lg:grid-cols-[250px_minmax(0,1fr)_370px]">
        <aside className="rounded-2xl border border-border bg-card/50 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bloques de contenido</p><GripVertical size={14} className="text-muted-foreground" /></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Arrastrá un bloque al email o hacé clic para añadirlo.</p><div className="mt-4 grid grid-cols-2 gap-2">{palette.map(({ type, label, description, icon: Icon }) => <button key={type} type="button" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", `new:${type}`)} onClick={() => addBlock(type, label)} title={description} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-border/80 bg-background/30 px-2 py-3 text-center text-xs transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><Icon size={17} className="text-primary" />{label}</button>)}</div><div className="mt-6 border-t border-border pt-5"><p className="text-sm font-semibold">Columnas</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Elegí una estructura para organizar el contenido.</p><div className="mt-3 grid gap-2">{["Columna uno | Columna dos", "Columna uno | Columna dos | Columna tres"].map((content) => <button key={content} type="button" onClick={() => { const block = createBlock("columns", "Columnas"); block.content = content; setBlocks((current) => [...current, block]); setSelectedId(block.id); }} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs hover:border-primary/50 hover:bg-primary/5"><Columns2 size={15} className="text-primary" />{content.split("|").length} columnas<Plus size={13} className="ml-auto" /></button>)}</div></div></aside>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-[#e9edf2]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><div className="flex rounded-lg border border-slate-200 p-1"><button type="button" onClick={() => setDevice("desktop")} aria-pressed={device === "desktop"} className={`rounded px-3 py-1.5 text-xs ${device === "desktop" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}><Mail size={14} className="mr-1 inline" />Desktop</button><button type="button" onClick={() => setDevice("mobile")} aria-pressed={device === "mobile"} className={`rounded px-3 py-1.5 text-xs ${device === "mobile" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}><Smartphone size={14} className="mr-1 inline" />Móvil</button></div><span className="text-xs text-slate-500">{device === "desktop" ? "Vista de escritorio" : "Vista de móvil"}</span></div>
          <div className="flex justify-center overflow-x-auto">{editorMode === "html" ? <HtmlPreview source={htmlBody} device={device} /> : <EmailBlockCanvas blocks={blocks} selectedId={selectedId} device={device} onSelect={setSelectedId} onAddNested={addNestedBlock} onDropBlock={(sourceId, targetId) => sourceId.startsWith("new:") ? addBlock(sourceId.slice(4) as PaletteBlockType, palette.find((item) => item.type === sourceId.slice(4))?.label ?? "Bloque") : dropBlock(sourceId, targetId)} />}</div>
        </div>

        <aside className="rounded-2xl border border-border bg-card/50"><div className="flex items-center justify-between border-b border-border p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Editor</p><div className="flex rounded-lg border border-border p-0.5" aria-label="Modo de edición"><button type="button" onClick={() => setEditorMode("blocks")} className={`rounded-md px-2.5 py-1 text-xs ${editorMode === "blocks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Bloques</button><button type="button" onClick={() => setEditorMode("html")} className={`rounded-md px-2.5 py-1 text-xs ${editorMode === "html" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>HTML</button></div></div>{editorMode === "html" ? <div className="space-y-4 p-4"><div className="overflow-hidden rounded-lg border border-border"><CodeMirror value={htmlBody} height="520px" extensions={[html()]} onChange={setHtmlBody} theme="dark" basicSetup={{ lineNumbers: true, foldGutter: false }} /></div><p className="text-xs leading-5 text-muted-foreground">Podés pegar un documento HTML completo. El preview mostrará todo el contenido sin scrollbar interno y el servidor sanitizará el HTML al guardar.</p></div> : <BlockPropertiesPanel block={selectedBlock} tab={propertyTab} onTabChange={setPropertyTab} onUpdate={updateSelected} onMove={moveSelected} onDuplicate={duplicateSelected} onRemove={removeSelected} onSelect={setSelectedId} onAddNested={addNestedBlock} canRemove={blocks.length > 1} />}</aside>
       </section> : activeStep === "audience" ? <section className="rounded-2xl border border-border bg-card/60 p-6 sm:p-8"><div className="flex flex-col gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Audiencia</p><h2 className="font-heading text-2xl font-semibold">¿A quién querés enviarle?</h2><p className="max-w-2xl text-sm leading-6 text-muted-foreground">Las bajas y supresiones quedan excluidas automáticamente. La audiencia se congelará al guardar la campaña.</p></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => { setAudienceMode("all"); setSelectedSegmentId(""); }} className={`rounded-xl border p-4 text-left transition-colors ${audienceMode === "all" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Todos los suscriptos</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Contactos con consentimiento y estado suscripto.</p><p className="mt-4 text-2xl font-semibold">{eligibleContactCount}</p><p className="text-xs text-muted-foreground">contactos elegibles</p></button><button type="button" onClick={() => setAudienceMode("segment")} className={`rounded-xl border p-4 text-left transition-colors ${audienceMode === "segment" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}><p className="font-medium">Segmento guardado</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Reutilizá una audiencia filtrada por etiquetas y datos estructurados.</p><p className="mt-4 text-2xl font-semibold">{segments.length}</p><p className="text-xs text-muted-foreground">segmentos disponibles</p></button></div>{audienceMode === "segment" ? <label className="mt-5 block max-w-xl text-sm font-medium">Segmento<Select value={selectedSegmentId} onValueChange={(value) => setSelectedSegmentId(value ?? "")}><SelectTrigger className="mt-1.5 h-10 w-full"><SelectValue placeholder="Seleccioná un segmento" /></SelectTrigger><SelectContent><SelectItem value="">Seleccioná un segmento</SelectItem>{segments.map((segment) => <SelectItem key={segment.id} value={segment.id}>{segment.name}</SelectItem>)}</SelectContent></Select></label> : null}<div className="mt-6 rounded-xl border border-border/70 bg-background/30 p-4 text-xs text-muted-foreground">Los contactos `unsubscribed`, `suppressed` y sin consentimiento no pueden entrar en la audiencia.</div></section> : <section className="rounded-2xl border border-border bg-card/60 p-8 sm:p-12"><div className="mx-auto max-w-xl text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">{activeStep === "schedule" ? <CalendarClock size={22} /> : <Mail size={22} />}</div><h2 className="mt-5 font-heading text-2xl font-semibold">{activeStep === "schedule" ? "Programá el envío" : "Revisá antes de enviar"}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Esta fase se habilita después de confirmar la audiencia y el contenido.</p><button type="button" onClick={() => setActiveStep("content")} className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80">Volver al contenido</button></div></section>}

          {selectedAudience ? <AudienceSummary segment={selectedAudience} /> : null}
          {selectedAudience && selectedAudienceCount === 0 ? <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Este segmento no tiene contactos elegibles. Elegí otro segmento para continuar.</p> : null}
          <footer className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><p className="text-xs text-muted-foreground">{activeStep === "audience" ? `${selectedAudienceCount} contactos elegibles en la audiencia seleccionada.` : "La campaña conserva la audiencia elegida y el contenido actual."}</p><div className="flex flex-wrap gap-2"><button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-50"><Save size={14} /> {pending ? "Guardando…" : campaign ? "Guardar cambios" : "Guardar borrador"}</button><button type="button" onClick={continueWizard} disabled={pending || (activeStep === "audience" && selectedAudienceCount === 0)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50">Continuar</button></div>{state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}{state.success ? <p role="status" className="text-xs text-accent">{state.success}</p> : null}{feedback ? <p role="status" className="text-xs text-accent">{feedback}</p> : null}</footer>
      </form>
      {showPreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Vista previa del email"><div className="flex max-h-[calc(100svh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-3"><div><p className="text-sm font-semibold">Vista previa</p><p className="text-xs text-muted-foreground">Así se verá el correo para tus contactos.</p></div><button type="button" onClick={() => setShowPreview(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">Cerrar</button></div><div className="min-h-0 overflow-auto bg-[#e9edf2] p-4 sm:p-8">{editorMode === "html" ? <HtmlPreview source={htmlBody} device="desktop" /> : <EmailBlockCanvas blocks={blocks} selectedId="" device="desktop" onSelect={() => undefined} onAddNested={() => undefined} onDropBlock={() => undefined} />}</div></div></div>}
       {showTestEmail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Enviar email de prueba"><form action={testFormAction} className="w-full max-w-md rounded-2xl border border-[#294447] bg-[#0d2325] p-5 text-white shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Enviar prueba</p><p className="mt-1 text-xs leading-5 text-white/65">Se enviará una copia del contenido actual al correo indicado.</p></div><button type="button" onClick={() => setShowTestEmail(false)} className="text-xs text-white/65 hover:text-white">Cerrar</button></div><input type="hidden" name="subject" value={subject} /><input type="hidden" name="content" value={JSON.stringify(contentDocument)} readOnly /><label className="mt-5 block text-sm font-medium">Correo de destino<input name="email" type="email" required placeholder="tu@correo.com" className="mt-1.5 h-10 w-full rounded-lg border border-[#294447] bg-[#10292b] px-3 text-sm text-white outline-none placeholder:text-white/45 focus-visible:ring-3 focus-visible:ring-primary/50" /></label><button type="submit" disabled={testPending} className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">{testPending ? "Enviando…" : "Enviar prueba"}</button>{testState.error ? <p role="alert" className="mt-3 text-xs text-red-300">{testState.error}</p> : null}{testState.success ? <p role="status" className="mt-3 text-xs text-accent">{testState.success}</p> : null}</form></div>}
    </div>
  );
}
