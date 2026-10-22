"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Columns2, Image, Mail, Minus, MousePointerClick, Plus, Save, Type } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { createEmailCampaignAction, type CreateEmailCampaignFormState } from "../actions";

type Block =
  | { id: string; type: "text"; label: string; content: string }
  | { id: string; type: "button"; label: string; content: string }
  | { id: string; type: "image"; label: string; content: string }
  | { id: string; type: "divider"; label: string; content: string }
  | { id: string; type: "columns"; label: string; content: string };

const palette = [
  { type: "text" as const, label: "Texto", icon: Type },
  { type: "image" as const, label: "Imagen", icon: Image },
  { type: "button" as const, label: "Botón", icon: MousePointerClick },
  { type: "divider" as const, label: "Separador", icon: Minus },
  { type: "columns" as const, label: "Columnas", icon: Columns2 },
];

const initialBlocks: Block[] = [
  { id: "intro", type: "text", label: "Texto", content: "Hola {{first_name}}, tenemos algo nuevo para vos." },
  { id: "cta", type: "button", label: "Botón", content: "Conocé más" },
];

const initialHtml = `<h1 style="margin:0 0 16px;color:#1d2430">Hola {{first_name}}</h1>\n<p style="margin:0 0 16px;line-height:1.6">Tenemos algo nuevo para vos.</p>\n<p><a href="https://example.com" style="display:inline-block;padding:12px 18px;background:#ff6f2c;color:#fff;text-decoration:none;border-radius:8px">Conocé más</a></p>`;

function previewHtml(document: { mode: "blocks" | "html"; bodyHtml?: string; blocks?: Block[] }): string {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const body = document.mode === "html"
    ? (document.bodyHtml ?? "")
    : (document.blocks ?? []).map((block) => {
      if (block.type === "text") return `<p style="line-height:1.6">${escape(block.content)}</p>`;
      if (block.type === "button") return `<p><a href="https://example.com" style="display:inline-block;padding:12px 18px;background:#ff6f2c;color:#fff;text-decoration:none;border-radius:8px">${escape(block.content)}</a></p>`;
      if (block.type === "divider") return "<hr />";
      if (block.type === "columns") return `<table width="100%"><tr><td>${escape(block.content)}</td></tr></table>`;
      return "<div style=\"height:96px;background:#eef1f5\"></div>";
    }).join("");

  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;color:#1d2430;font-family:Arial,sans-serif"><main style="max-width:640px;margin:0 auto;padding:32px 20px;background:#fff">${body}</main><footer style="max-width:640px;margin:0 auto;padding:16px 20px;text-align:center;font:12px Arial,sans-serif;color:#667085">Darse de baja</footer></body></html>`;
}

export function EmailMarketingWizard() {
  const [state, formAction, pending] = useActionState<CreateEmailCampaignFormState, FormData>(createEmailCampaignAction, {});
  const [activeStep, setActiveStep] = useState<"audience" | "content" | "schedule" | "review">("content");
  const [editorMode, setEditorMode] = useState<"blocks" | "html">("blocks");
  const [blocks, setBlocks] = useState(initialBlocks);
  const [htmlBody, setHtmlBody] = useState(initialHtml);
  const [selectedId, setSelectedId] = useState("intro");
  const [feedback, setFeedback] = useState("");

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? blocks[0];
  const blockDocument = {
    version: 1 as const,
    mode: "blocks" as const,
    blocks: blocks.map((block) => {
      if (block.type === "text") return { id: block.id, type: block.type, text: block.content };
      if (block.type === "button") return { id: block.id, type: block.type, label: block.content, href: "https://example.com" };
      if (block.type === "image") return { id: block.id, type: block.type, src: "https://example.com/image.jpg", alt: block.content };
      if (block.type === "columns") return { id: block.id, type: block.type, columns: block.content.split("|").map((column) => column.trim()) };
      return { id: block.id, type: block.type };
    }),
  };
  const contentDocument = editorMode === "html"
    ? { version: 1 as const, mode: "html" as const, bodyHtml: htmlBody }
    : blockDocument;

  function addBlock(type: Block["type"], label: string) {
    const id = `${type}-${blocks.length + 1}`;
    const content = type === "button" ? "Ver evento" : type === "image" ? "https://images.example.com/hero.jpg" : type === "divider" ? "" : type === "columns" ? "Columna uno | Columna dos" : "Escribí el mensaje de tu campaña.";
    const next = { id, type, label, content } as Block;
    setBlocks((current) => [...current, next]);
    setSelectedId(id);
  }

  function updateSelectedContent(content: string) {
    setBlocks((current) => current.map((block) => (block.id === selectedId ? { ...block, content } : block)));
  }

  return (
    <form action={formAction} className="flex min-h-[calc(100svh-7rem)] w-full min-w-0 flex-col gap-5">
      <input type="hidden" name="name" value="Nueva campaña" />
      <input type="hidden" name="subject" value="Tu próxima novedad" />
      <input type="hidden" name="content" value={JSON.stringify(contentDocument)} readOnly />
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Campaign studio</p>
            <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Nueva campaña</h1>
            <p className="mt-2 text-sm text-muted-foreground">Construí el email, revisá la audiencia y programá el envío.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-accent" /> Borrador local</div>
        </div>
        <nav aria-label="Pasos de la campaña" className="grid gap-2 sm:grid-cols-4">
          {([
            ["audience", "Audiencia"],
            ["content", "Contenido"],
            ["schedule", "Programación"],
            ["review", "Revisión"],
          ] as const).map(([value, label], index) => (
            <button key={value} type="button" onClick={() => setActiveStep(value)} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${activeStep === value ? "border-primary/70 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
              <span className="font-mono text-[10px] text-primary">0{index + 1}</span>{label}
            </button>
          ))}
        </nav>
      </header>

      {activeStep === "content" ? (
        <section className="grid min-h-[620px] min-w-0 flex-1 gap-4 lg:min-h-0 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
           <aside className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-card/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bloques</p>
            <div className="mt-4 grid gap-2">
              {palette.map(({ type, label, icon: Icon }) => (
                <button key={type} type="button" onClick={() => addBlock(type, label)} className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/30 px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Icon size={15} className="text-primary" />{label}<Plus size={13} className="ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
             <div className="mt-6 rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">Podés empezar con bloques o editar directamente el HTML del cuerpo del email.</div>
           </aside>

           <div className="min-h-0 min-w-0 overflow-auto rounded-2xl border border-border bg-[#e9edf2] p-5 sm:p-8 lg:p-10">
             <div className="w-full overflow-hidden rounded-xl bg-white shadow-xl shadow-black/10">
               <iframe title="Vista previa del email" sandbox="" srcDoc={previewHtml({ ...contentDocument, blocks })} className="min-h-[620px] w-full border-0" />
             </div>
           </div>

           <aside className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-card/50 p-4">
             <div className="flex items-center justify-between gap-3">
               <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Editor</p>
               <div className="flex rounded-lg border border-border p-0.5" aria-label="Modo de edición">
                 {(["blocks", "html"] as const).map((mode) => (
                   <button key={mode} type="button" onClick={() => setEditorMode(mode)} className={`rounded-md px-2.5 py-1 text-xs transition-colors ${editorMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                     {mode === "blocks" ? "Bloques" : "HTML"}
                   </button>
                 ))}
               </div>
             </div>
             {editorMode === "html" ? (
               <div className="mt-4 space-y-4">
                 <div className="overflow-hidden rounded-lg border border-border">
                   <CodeMirror value={htmlBody} height="420px" extensions={[html()]} onChange={setHtmlBody} theme="dark" basicSetup={{ lineNumbers: true, foldGutter: false }} />
                 </div>
                 <p className="text-xs leading-5 text-muted-foreground">Solo se guarda el cuerpo. Se eliminan scripts, iframes, formularios, eventos inline y URLs no seguras al guardar.</p>
               </div>
             ) : (
               <div className="mt-4 space-y-4">
                 <label className="block text-sm font-medium">Bloque seleccionado<input value={selectedBlock?.label ?? ""} readOnly className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background/50 px-3 text-sm text-muted-foreground" /></label>
                 <label className="block text-sm font-medium">Contenido<textarea value={selectedBlock?.content ?? ""} onChange={(event) => updateSelectedContent(event.target.value)} rows={5} className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
               </div>
             )}
             <div className="mt-4 rounded-xl border border-border bg-background/30 p-3 text-xs leading-5 text-muted-foreground">Variables disponibles: <code className="text-primary">{"{{first_name}}"}</code>, <code className="text-primary">{"{{event_name}}"}</code> y <code className="text-primary">{"{{event_date}}"}</code>.</div>
           </aside>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card/60 p-8 sm:p-12">
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">{activeStep === "schedule" ? <CalendarClock size={22} /> : <Mail size={22} />}</div>
            <h2 className="mt-5 font-heading text-2xl font-semibold">{activeStep === "audience" ? "Elegí la audiencia" : activeStep === "schedule" ? "Programá el envío" : "Revisá antes de enviar"}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Este paso ya está diseñado y se conectará con contactos, segmentos y Resend en la siguiente unidad de persistencia.</p>
            <button type="button" onClick={() => setActiveStep("content")} className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Ir al contenido</button>
          </div>
        </section>
      )}

      <footer className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-xs text-muted-foreground">La persistencia y el envío se habilitarán cuando estén conectados los contactos y Resend.</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"><Save size={14} /> {pending ? "Guardando…" : "Guardar borrador"}</button>
          <button type="button" onClick={() => setFeedback("Primero conectemos la audiencia y la revisión de consentimiento.")} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Continuar</button>
        </div>
        {state.error ? <p role="alert" className="text-xs text-destructive">{state.error}</p> : null}
        {state.success ? <p role="status" className="text-xs text-accent">{state.success}</p> : null}
        {feedback ? <p role="status" className="text-xs text-accent">{feedback}</p> : null}
      </footer>
    </form>
  );
}
