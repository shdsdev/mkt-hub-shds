"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  claimDrawAction,
  createPrizeAction,
  drawPrizeAction,
  increasePrizeQuantityAction,
  invalidateDrawAction,
  revealDrawAction,
  togglePrizeAction,
  type RaffleActionState,
} from "./actions";
import type { RaffleAuditRow, RaffleDrawRow, RafflePrizeRow, RaffleRow } from "@/modules/raffles";

type Event = { id: string; name: string; startsAt?: Date | null; status?: string };

const statusLabels: Record<string, string> = { not_configured: "Sin configurar", ready: "Listo", active: "En curso", finished: "Finalizado", paused: "Pausado", pending_reveal: "Por revelar", revealed: "Revelado", claimed: "Entregado", unclaimed: "No reclamado", invalidated: "Invalidado" };

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Field({ label, name, type = "text", placeholder, required }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium text-foreground">{label}</span><Input name={name} type={type} placeholder={placeholder} required={required} /></label>;
}

function StateMessage({ state }: { state: RaffleActionState }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? "alert" : "status"} className={state.error ? "text-sm text-destructive" : "text-sm text-accent"}>{state.error ?? state.success}</p>;
}

async function runAction(action: (formData: FormData) => Promise<unknown>, formData: FormData): Promise<void> {
  await action(formData);
}

function SubmitButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button {...props} disabled={pending || props.disabled}>{pending ? "Procesando..." : children}</Button>;
}

function WinnerName({ name }: { name: string }) {
  return <span aria-label={name} className="inline-flex flex-wrap" data-reveal="winner">{[...name].map((character, index) => <span key={`${character}-${index}`} className="animate-[raffle-reveal_650ms_ease-out_both]" style={{ animationDelay: `${index * 35}ms` }}>{character === " " ? "\u00a0" : character}</span>)}</span>;
}

function DrawRow({ eventId, draw }: { eventId: string; draw: RaffleDrawRow }) {
  return <article className="border-t border-border/70 py-4 first:border-t-0">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-sm font-semibold"><WinnerName name={draw.attendeeName} /></p><p className="text-xs text-muted-foreground">{draw.attendeeEmail} · código {draw.attendeeCode}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(draw.drawnAt)} · {draw.eligibleCount} elegibles</p></div>
      <span className="w-fit rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground">{statusLabels[draw.status] ?? draw.status}</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {draw.status === "pending_reveal" && <form action={(formData) => runAction(revealDrawAction, formData)}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><SubmitButton size="sm" type="submit">Revelar ganador</SubmitButton></form>}
      {draw.status === "revealed" && <form action={(formData) => runAction(claimDrawAction, formData)}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><SubmitButton size="sm" variant="secondary" type="submit">Marcar entregado</SubmitButton></form>}
      {!(["claimed", "invalidated", "unclaimed"].includes(draw.status)) && <form action={(formData) => runAction(invalidateDrawAction, formData)} className="flex min-w-[min(100%,22rem)] flex-1 gap-2"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><Input name="reason" placeholder="Motivo para invalidar" aria-label="Motivo para invalidar" required /><SubmitButton size="sm" variant="destructive" type="submit">Invalidar</SubmitButton></form>}
    </div>
  </article>;
}

function PrizeCard({ eventId, raffleId, prize, draws }: { eventId: string; raffleId: string; prize: RafflePrizeRow; draws: RaffleDrawRow[] }) {
  const prizeDraws = draws.filter((draw) => draw.prizeId === prize.id).toReversed();
  return <section className="overflow-hidden rounded-2xl border border-border bg-card/70 shadow-sm">
     <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Premio</span><span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{statusLabels[prize.status]}</span></div><h2 className="font-heading text-xl font-semibold tracking-tight">{prize.name}</h2><p className="mt-1 text-sm text-muted-foreground">{prize.drawnQuantity} de {prize.quantity} unidades sorteadas</p></div><div className="flex gap-2"><form action={(formData) => runAction(togglePrizeAction, formData)}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="raffleId" value={raffleId} /><input type="hidden" name="prizeId" value={prize.id} /><input type="hidden" name="status" value={prize.status === "paused" ? "ready" : "paused"} /><SubmitButton type="submit" size="sm" variant="outline" disabled={prize.status === "finished"}>{prize.status === "paused" ? "Reanudar" : "Pausar"}</SubmitButton></form><form action={(formData) => runAction(increasePrizeQuantityAction, formData)} className="flex gap-1"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="raffleId" value={raffleId} /><input type="hidden" name="prizeId" value={prize.id} /><Input className="w-16" type="number" name="amount" min="1" defaultValue="1" aria-label="Unidades a agregar" /><SubmitButton type="submit" size="sm" variant="secondary">+ unidades</SubmitButton></form></div></header>
     <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]"><div className="space-y-4"><div className="grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-xs uppercase tracking-wider text-muted-foreground">Condiciones</span><p className="mt-1">{prize.conditions || "Sin condiciones adicionales"}</p></div><div><span className="text-xs uppercase tracking-wider text-muted-foreground">Entrega</span><p className="mt-1">{prize.fulfillmentContact || "Sin contacto definido"}</p></div><div><span className="text-xs uppercase tracking-wider text-muted-foreground">Instrucciones</span><p className="mt-1">{prize.instructions || "Sin instrucciones"}</p></div><div><span className="text-xs uppercase tracking-wider text-muted-foreground">Límite de reclamo</span><p className="mt-1">{formatDate(prize.claimDeadlineAt)}</p></div></div><form action={(formData) => runAction(drawPrizeAction, formData)} className="rounded-xl border border-primary/30 bg-primary/5 p-4"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="prizeId" value={prize.id} /><h3 className="font-medium">Sortear otra unidad</h3><p className="mt-1 text-xs text-muted-foreground">Solo participan asistentes activos y registrados en check-in.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><Input name="occupation" placeholder="Ocupación" aria-label="Filtrar por ocupación" /><Input name="clientBrands" placeholder="Marcas, separadas por coma" aria-label="Filtrar por marcas de cliente" /><Input name="interests" placeholder="Intereses, separados por coma" aria-label="Filtrar por intereses" /></div><SubmitButton className="mt-3 w-full sm:w-auto" type="submit" disabled={prize.status === "paused" || prize.status === "finished"}>Sortear ganador</SubmitButton></form></div><div className="rounded-xl border border-border/70 bg-background/30 p-4"><div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-semibold">Historial de ganadores</h3><span className="text-xs text-muted-foreground">{prizeDraws.length}</span></div>{prizeDraws.length ? prizeDraws.map((draw) => <DrawRow key={draw.id} eventId={eventId} draw={draw} />) : <p className="py-6 text-sm text-muted-foreground">Todavía no hay ganadores. El primer sorteo aparecerá aquí.</p>}</div></div>
  </section>;
}

export function RaffleManagement({ event, raffle, prizes, draws, audit }: { event: Event; raffle: RaffleRow; prizes: RafflePrizeRow[]; draws: RaffleDrawRow[]; audit: RaffleAuditRow[] }) {
  const [state, action] = useActionState(createPrizeAction, {});
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 sm:px-6"><header className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-6 shadow-sm sm:p-8"><div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" /><div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Control de sorteo · {statusLabels[raffle.status]}</p><h1 className="mt-2 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{event.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Configura premios, filtra la audiencia elegible y controla cada ganador con trazabilidad completa.</p><div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-3"><div><p className="text-2xl font-semibold">{prizes.length}</p><p className="text-xs text-muted-foreground">Premios</p></div><div><p className="text-2xl font-semibold">{draws.filter((draw) => draw.status !== "invalidated").length}</p><p className="text-xs text-muted-foreground">Resultados válidos</p></div><div><p className="text-2xl font-semibold">{audit.length}</p><p className="text-xs text-muted-foreground">Eventos auditados</p></div></div></div></header>
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]"><div className="space-y-5"><section className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 sm:p-6"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Nueva configuración</p><h2 className="mt-1 font-heading text-2xl font-semibold">Agregar premio</h2><p className="mt-1 text-sm text-muted-foreground">Define la unidad de premio y las reglas que verá el equipo de entrega.</p></div><form action={action} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="raffleId" value={raffle.id} /><Field label="Nombre del premio" name="name" placeholder="Ej. Experiencia gastronómica" required /><Field label="Cantidad de unidades" name="quantity" type="number" placeholder="1" required /><label className="flex flex-col gap-1.5 text-sm sm:col-span-2"><span className="font-medium">Instrucciones de entrega</span><textarea name="instructions" className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Qué debe hacer el ganador para reclamar" /></label><Field label="Fecha límite de reclamo" name="claimDeadlineAt" type="datetime-local" /><Field label="Contacto de entrega" name="fulfillmentContact" placeholder="Nombre, correo o teléfono" /><label className="flex flex-col gap-1.5 text-sm sm:col-span-2"><span className="font-medium">Condiciones</span><textarea name="conditions" className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Restricciones, ubicación o requisitos" /></label><label className="flex flex-col gap-1.5 text-sm sm:col-span-2"><span className="font-medium">Política de ganadores</span><Select name="winnerPolicy" defaultValue="exclude_winners" items={[{ value: "exclude_winners", label: "Excluir ganadores anteriores" }, { value: "include_winners", label: "Incluir ganadores anteriores" }]}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclude_winners">Excluir ganadores anteriores</SelectItem><SelectItem value="include_winners">Incluir ganadores anteriores</SelectItem></SelectContent></Select></label><div className="flex flex-col gap-2 sm:col-span-2"><Button type="submit">Guardar premio</Button><StateMessage state={state} /></div></form></section>{prizes.length ? prizes.map((prize) => <PrizeCard key={prize.id} eventId={event.id} raffleId={raffle.id} prize={prize} draws={draws} />) : <section className="rounded-2xl border border-border p-8 text-center"><p className="font-heading text-xl font-semibold">El tablero está listo</p><p className="mt-2 text-sm text-muted-foreground">Agrega el primer premio para habilitar los sorteos.</p></section>}</div><aside className="h-fit rounded-2xl border border-border bg-card/50 p-5 xl:sticky xl:top-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bitácora</p><h2 className="mt-1 font-heading text-xl font-semibold">Actividad reciente</h2>{audit.length ? <ol className="mt-5 space-y-4">{audit.toReversed().slice(0, 10).map((entry) => <li key={entry.id} className="border-l border-primary/40 pl-3"><p className="text-sm font-medium">{statusLabels[entry.action] ?? entry.action}</p><p className="mt-0.5 text-xs text-muted-foreground">{entry.actorEmail}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">Las acciones del equipo aparecerán aquí.</p>}</aside></div></main>;
}
