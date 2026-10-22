"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Columns2, Image, Mail, Minus, MousePointerClick, Plus, Save, Type } from "lucide-react";
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

export function EmailMarketingWizard() {
  const [state, formAction, pending] = useActionState<CreateEmailCampaignFormState, FormData>(createEmailCampaignAction, {});
  const [activeStep, setActiveStep] = useState<"audience" | "content" | "schedule" | "review">("content");
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedId, setSelectedId] = useState("intro");
  const [feedback, setFeedback] = useState("");

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? blocks[0];
  const contentDocument = {
    version: 1 as const,
    blocks: blocks.map((block) => {
      if (block.type === "text") return { id: block.id, type: block.type, text: block.content };
      if (block.type === "button") return { id: block.id, type: block.type, label: block.content, href: "https://example.com" };
      if (block.type === "image") return { id: block.id, type: block.type, src: "https://example.com/image.jpg", alt: block.content };
      if (block.type === "columns") return { id: block.id, type: block.type, columns: block.content.split("|").map((column) => column.trim()) };
      return { id: block.id, type: block.type };
    }),
  };

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
    <form action={formAction} className="flex flex-col gap-5">
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
        <section className="grid min-h-[620px] gap-4 lg:grid-cols-[190px_minmax(0,1fr)_270px]">
          <aside className="rounded-2xl border border-border bg-card/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bloques</p>
            <div className="mt-4 grid gap-2">
              {palette.map(({ type, label, icon: Icon }) => (
                <button key={type} type="button" onClick={() => addBlock(type, label)} className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/30 px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Icon size={15} className="text-primary" />{label}<Plus size={13} className="ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">Arrancá con bloques simples. El editor HTML avanzado llega en una fase posterior.</div>
          </aside>

          <div className="rounded-2xl border border-border bg-[#e9edf2] p-4 sm:p-7">
            <div className="mx-auto max-w-[640px] overflow-hidden rounded-xl bg-white shadow-xl shadow-black/10">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><span className="font-semibold text-slate-900">Marketing Hub</span><Mail size={16} className="text-orange-500" /></div>
              <div className="space-y-4 p-6 text-slate-800">
                {blocks.map((block) => (
                  <button key={block.id} type="button" onClick={() => setSelectedId(block.id)} className={`block w-full rounded-lg p-3 text-left transition ${selectedId === block.id ? "outline outline-2 outline-orange-400 outline-offset-2" : "hover:bg-slate-50"}`}>
                    {block.type === "text" && <p className="text-base leading-7">{block.content}</p>}
                    {block.type === "button" && <span className="inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white">{block.content}</span>}
                    {block.type === "image" && <div className="flex h-24 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">Vista previa de imagen</div>}
                    {block.type === "divider" && <hr className="border-slate-200" />}
                    {block.type === "columns" && <div className="grid grid-cols-2 gap-3 text-sm"><span className="rounded bg-slate-100 p-3">Columna uno</span><span className="rounded bg-slate-100 p-3">Columna dos</span></div>}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400">Enviado desde Marketing Hub · Darse de baja</div>
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-card/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Propiedades</p>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium">Bloque seleccionado<input value={selectedBlock?.label ?? ""} readOnly className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background/50 px-3 text-sm text-muted-foreground" /></label>
              <label className="block text-sm font-medium">Contenido<textarea value={selectedBlock?.content ?? ""} onChange={(event) => updateSelectedContent(event.target.value)} rows={5} className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
              <div className="rounded-xl border border-border bg-background/30 p-3 text-xs leading-5 text-muted-foreground">Variables disponibles: <code className="text-primary">{"{{first_name}}"}</code>, <code className="text-primary">{"{{event_name}}"}</code> y <code className="text-primary">{"{{event_date}}"}</code>.</div>
            </div>
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
