"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarDays, ChevronDown, CircleHelp, Clock3, Info, Pause, Play, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip } from "@/components/tooltip";
import {
  claimDrawAction,
  createPrizeAction,
  drawPrizeAction,
  increasePrizeQuantityAction,
  invalidateDrawAction,
  rotateRaffleStageTokenAction,
  togglePrizeAction,
  type RaffleActionState,
} from "./actions";
import type { RaffleAuditRow, RaffleDrawRow, RafflePrizeRow, RaffleRow } from "@/modules/raffles";
import { getRaffleFilterOptions } from "@/lib/events/raffle-filter-labels";

type Event = { id: string; name: string; startsAt?: Date | null; status?: string };

type FilterOptions = {
  occupations: string[];
  clientBrands: string[];
  interests: string[];
};

const statusLabels: Record<string, string> = {
  not_configured: "Sin configurar",
  ready: "Listo",
  active: "En curso",
  finished: "Finalizado",
  paused: "Pausado",
  pending_reveal: "Por revelar",
  revealed: "Revelado",
  claimed: "Entregado",
  unclaimed: "No reclamado",
  invalidated: "Invalidado",
};

const auditLabels: Record<string, string> = {
  draw: "Unidad sorteada",
  reveal: "Ganador revelado",
  claim: "Premio entregado",
  invalidate: "Sorteo invalidado",
  validate: "Participante validado",
  resend_request: "Reenvío solicitado",
  prize_change: "Premio actualizado",
  status_change: "Estado actualizado",
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sin fecha límite";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDateInput(value: Date | undefined) {
  if (!value) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(value: Date | undefined) {
  if (!value) return "Seleccionar fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(value);
}

function SubmitButton({ children, pendingLabel = "Procesando…", ...props }: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} disabled={pending || props.disabled}>{pending ? pendingLabel : children}</Button>;
}

function StateMessage({ state }: { state: RaffleActionState }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-destructive" : "text-accent"}`}>{state.error ?? state.success}</p>;
}

function useRaffleAction(action: (formData: FormData) => Promise<RaffleActionState>) {
  return useActionState(async (_state: RaffleActionState, formData: FormData) => action(formData), {});
}

function DateTimeField() {
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("18:00");
  const [hour24, minute] = time.split(":");
  const hourNumber = Number(hour24);
  const hour12 = String(hourNumber % 12 || 12).padStart(2, "0");
  const period = hourNumber >= 12 ? "pm" : "am";
  const value = date ? `${formatDateInput(date)}T${time}` : "";

  function updateHour(nextHour: string, nextPeriod = period) {
    const numericHour = Number(nextHour) % 12;
    const normalizedHour = nextPeriod === "pm" ? numericHour + 12 : numericHour;
    setTime(`${String(normalizedHour).padStart(2, "0")}:${minute}`);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm sm:col-span-3">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">Fecha límite de reclamo</span>
        <Tooltip label="Ejemplo: 30 oct 2026, 6:00 p. m. Después de esta hora ya no se podrán reclamar unidades.">
          <CircleHelp className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Tooltip>
      </div>
      <input type="hidden" name="claimDeadlineAt" value={value} />
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" className="w-full min-w-0 flex-none justify-start gap-2 font-normal sm:w-72"><CalendarDays className="size-4 text-muted-foreground" />{formatDateLabel(date)}</Button>} />
          <PopoverContent align="start" className="w-auto p-3">
            <Calendar mode="single" selected={date} onSelect={setDate} disabled={{ before: new Date() }} />
            {date ? <Button type="button" variant="ghost" size="sm" onClick={() => setDate(undefined)}>Limpiar fecha</Button> : null}
          </PopoverContent>
        </Popover>
          <div className="flex w-48 shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2">
           <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
           <span className="sr-only">Hora límite</span>
           <Select value={hour12} onValueChange={(value) => updateHour(value ?? hour12)}>
             <SelectTrigger className="h-8 min-w-14 border-0 bg-transparent px-1 shadow-none" aria-label="Hora límite de reclamo"><SelectValue /></SelectTrigger>
             <SelectContent>{Array.from({ length: 12 }, (_, index) => { const value = String(index + 1).padStart(2, "0"); return <SelectItem key={value} value={value}>{value}</SelectItem>; })}</SelectContent>
           </Select>
           <span aria-hidden="true">:</span>
           <Select value={minute} onValueChange={(value) => setTime(`${hour24}:${value ?? minute}`)}>
             <SelectTrigger className="h-8 min-w-14 border-0 bg-transparent px-1 shadow-none" aria-label="Minutos límite de reclamo"><SelectValue /></SelectTrigger>
             <SelectContent>{Array.from({ length: 12 }, (_, index) => { const value = String(index * 5).padStart(2, "0"); return <SelectItem key={value} value={value}>{value}</SelectItem>; })}</SelectContent>
           </Select>
           <Select value={period} onValueChange={(value) => updateHour(hour12, value ?? period)}>
             <SelectTrigger className="h-8 min-w-16 border-0 bg-transparent px-1 shadow-none" aria-label="Periodo de la hora límite"><SelectValue /></SelectTrigger>
             <SelectContent><SelectItem value="am">a. m.</SelectItem><SelectItem value="pm">p. m.</SelectItem></SelectContent>
           </Select>
         </div>
      </div>
      <p className="text-xs text-muted-foreground">Opcional. Si lo dejas vacío, el premio no tendrá fecha de vencimiento.</p>
    </div>
  );
}

function FilterSelect({ name, label, filterName, options }: { name: string; label: string; filterName: "occupation" | "clientBrands" | "interests"; options: string[] }) {
  const filterOptions = getRaffleFilterOptions(filterName, options);
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <Select name={name} defaultValue="all">
        <SelectTrigger className="w-full bg-background/60 font-normal"><SelectValue /></SelectTrigger>
        <SelectContent>
          {filterOptions.map((option) => <SelectItem key={option.value || "all"} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}

function WinnerName({ name }: { name: string }) {
  return <span aria-label={name} className="inline-flex flex-wrap" data-reveal="winner">{[...name].map((character, index) => <span key={`${character}-${index}`} className="animate-[raffle-reveal_650ms_ease-out_both]" style={{ animationDelay: `${index * 35}ms` }}>{character === " " ? "\u00a0" : character}</span>)}</span>;
}

function DrawRow({ eventId, draw }: { eventId: string; draw: RaffleDrawRow }) {
  const [claimState, claimAction] = useRaffleAction(claimDrawAction);
  const [invalidateState, invalidateAction] = useRaffleAction(invalidateDrawAction);
  const state = claimState.error || claimState.success ? claimState : invalidateState;

  return <article className="rounded-xl border border-border/70 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-sm font-semibold"><WinnerName name={draw.attendeeName} /></p><p className="text-xs text-muted-foreground">{draw.attendeeEmail} · código {draw.attendeeCode}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(draw.drawnAt)} · {draw.eligibleCount} participantes elegibles</p></div>
      <span className="w-fit rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground">{statusLabels[draw.status] ?? draw.status}</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {(draw.status === "pending_reveal" || draw.status === "revealed") && <form action={claimAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><SubmitButton size="sm" variant="secondary" type="submit" pendingLabel="Confirmando y enviando…">Confirmar ganador y enviar correo</SubmitButton></form>}
      {draw.status === "claimed" && <form action={claimAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><SubmitButton size="sm" variant="outline" type="submit" pendingLabel="Reenviando…">Reenviar correo</SubmitButton></form>}
      {!( ["claimed", "invalidated", "unclaimed"].includes(draw.status)) && <form action={invalidateAction} className="flex min-w-[min(100%,22rem)] flex-1 gap-2"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><Input name="reason" placeholder="Motivo para invalidar" aria-label="Motivo para invalidar" required /><SubmitButton size="sm" variant="destructive" type="submit">Invalidar</SubmitButton></form>}
    </div>
    <StateMessage state={state} />
  </article>;
}

function PrizeCard({ eventId, raffleId, prize, draws, filterOptions }: { eventId: string; raffleId: string; prize: RafflePrizeRow; draws: RaffleDrawRow[]; filterOptions: FilterOptions }) {
  const [open, setOpen] = useState(true);
  const [toggleState, toggleAction] = useRaffleAction(togglePrizeAction);
  const [quantityState, quantityAction] = useRaffleAction(increasePrizeQuantityAction);
  const [drawState, drawAction] = useRaffleAction(drawPrizeAction);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const prizeDraws = draws.filter((draw) => draw.prizeId === prize.id).toReversed();
  const isPaused = prize.status === "paused";

  return <section className="overflow-hidden rounded-2xl border border-border bg-card/70 shadow-sm">
    <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isPaused ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}><Sparkles className="size-4" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Premio</span><span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{statusLabels[prize.status]}</span></span><span className="mt-2 block truncate font-heading text-xl font-semibold tracking-tight">{prize.name}</span><span className="mt-1 block text-sm text-muted-foreground">{prize.drawnQuantity} de {prize.quantity} unidades sorteadas</span></span>
        <ChevronDown className={`ml-auto size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <form action={toggleAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="raffleId" value={raffleId} /><input type="hidden" name="prizeId" value={prize.id} /><input type="hidden" name="status" value={isPaused ? "ready" : "paused"} /><SubmitButton type="submit" size="icon" variant="outline" disabled={prize.status === "finished"} aria-label={isPaused ? "Reanudar premio" : "Pausar premio"} title={isPaused ? "Reanudar premio" : "Pausar premio"}>{isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}</SubmitButton></form>
        <form action={quantityAction} className="flex gap-1"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="raffleId" value={raffleId} /><input type="hidden" name="prizeId" value={prize.id} /><Input className="w-16" type="number" name="amount" min="1" defaultValue="1" aria-label="Unidades a agregar" /><SubmitButton type="submit" size="icon" variant="secondary" aria-label="Agregar unidades" title="Agregar unidades"><Plus className="size-4" /></SubmitButton></form>
      </div>
    </header>
    {open ? <div className="grid gap-5 p-5 lg:grid-cols-3">
        <div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-background/20">
          <div className="grid gap-1 p-4"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condiciones</span><p className="text-sm leading-6">{prize.conditions || "Sin condiciones adicionales."}</p></div>
          <div className="grid gap-1 p-4"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entrega</span><p className="text-sm leading-6">{prize.fulfillmentContact || "Sin contacto definido."}</p></div>
          <div className="grid gap-1 p-4"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cómo reclamar</span><p className="text-sm leading-6">{prize.instructions || "Sin instrucciones adicionales."}</p><p className="text-xs text-muted-foreground">Límite: {formatDate(prize.claimDeadlineAt)}</p></div>
        </div>
        <form action={drawAction} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="prizeId" value={prize.id} /><input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <h3 className="font-medium">Sortear otra unidad</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Sin filtros participan todos los asistentes activos que hicieron check-in.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><FilterSelect name="occupation" label="Ocupación" filterName="occupation" options={filterOptions.occupations} /><FilterSelect name="clientBrands" label="Marca" filterName="clientBrands" options={filterOptions.clientBrands} /><FilterSelect name="interests" label="Interés" filterName="interests" options={filterOptions.interests} /></div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><SubmitButton className="w-full sm:w-auto" type="submit" disabled={isPaused || prize.status === "finished"} pendingLabel="Sorteando…">Sortear ganador</SubmitButton><span className="text-xs text-muted-foreground">Puedes ajustar los filtros antes de cada unidad.</span></div>
          <StateMessage state={drawState} />
        </form>
      <div className="rounded-xl border border-border/70 bg-background/30 p-4 lg:col-span-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Historial de ganadores</h3><span className="text-xs text-muted-foreground">{prizeDraws.length}</span></div>{prizeDraws.length ? <div className="grid gap-3 lg:grid-cols-2">{prizeDraws.map((draw) => <DrawRow key={draw.id} eventId={eventId} draw={draw} />)}</div> : <p className="py-6 text-sm leading-6 text-muted-foreground">Todavía no hay ganadores. El primer sorteo aparecerá aquí.</p>}</div>
    </div> : null}
    <StateMessage state={toggleState.error ? toggleState : quantityState} />
  </section>;
}

export function RaffleManagement({ event, raffle, prizes, draws, audit, filterOptions }: { event: Event; raffle: RaffleRow; prizes: RafflePrizeRow[]; draws: RaffleDrawRow[]; audit: RaffleAuditRow[]; filterOptions: FilterOptions }) {
  const [state, action] = useActionState(createPrizeAction, {});
  const [stageState, stageAction] = useActionState(rotateRaffleStageTokenAction, {});
  return <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pb-10 sm:px-6"><header className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-6 shadow-sm sm:p-8"><div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" /><div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Control de sorteo · {statusLabels[raffle.status]}</p><h1 className="mt-2 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{event.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Configura premios, define quién participa y controla cada ganador con trazabilidad clara.</p><div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div className="grid grid-cols-3 gap-3 sm:max-w-lg"><div><p className="text-2xl font-semibold">{prizes.length}</p><p className="text-xs text-muted-foreground">Premios</p></div><div><p className="text-2xl font-semibold">{draws.filter((draw) => draw.status !== "invalidated").length}</p><p className="text-xs text-muted-foreground">Resultados válidos</p></div><div><p className="text-2xl font-semibold">{audit.length}</p><p className="text-xs text-muted-foreground">Eventos auditados</p></div></div><form action={stageAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="eventId" value={event.id} /><SubmitButton type="submit" variant="secondary" pendingLabel="Generando…">Abrir modo escenario</SubmitButton>{stageState.stageUrl ? <a href={stageState.stageUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline underline-offset-4">Abrir pantalla</a> : null}</form></div><StateMessage state={stageState} /></div></header>
    <div className="space-y-7"><section className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 sm:p-6"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Nueva configuración</p><h2 className="mt-1 font-heading text-2xl font-semibold">Agregar premio</h2><p className="mt-1 text-sm text-muted-foreground">Define qué se entrega, cómo se reclama y hasta cuándo.</p></div><form action={action} className="grid gap-4 sm:grid-cols-3"><input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="raffleId" value={raffle.id} /><label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Nombre del premio</span><Input name="name" placeholder="Ej. Experiencia gastronómica" required /></label><label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Cantidad de unidades</span><Input name="quantity" type="number" min="1" placeholder="1" required /></label><DateTimeField /><label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Contacto de entrega</span><Input name="fulfillmentContact" placeholder="Ej. Ana · premios@shades.com · 33 1234 5678" /><span className="text-xs text-muted-foreground">Quién puede resolver dudas o entregar el premio.</span></label><label className="flex flex-col gap-1.5 text-sm sm:col-span-2"><span className="font-medium">Cómo reclamar</span><textarea name="instructions" className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Ej. Presenta tu código en recepción antes de la fecha límite." /><span className="text-xs text-muted-foreground">Describe el paso concreto que debe seguir la persona ganadora.</span></label><label className="flex flex-col gap-1.5 text-sm sm:col-span-3"><span className="font-medium">Condiciones</span><textarea name="conditions" className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Ej. Válido solo para asistentes con check-in confirmado." /><span className="text-xs text-muted-foreground">Restricciones, ubicación, documentación o requisitos especiales.</span></label><label className="flex flex-col gap-1.5 text-sm sm:col-span-3"><span className="flex items-center gap-1.5 font-medium">Política de ganadores <Tooltip label="Excluir evita que la misma persona gane este premio más de una vez. Incluir permite volver a seleccionarla."><Info className="size-3.5 text-muted-foreground" aria-hidden="true" /></Tooltip></span><Select name="winnerPolicy" defaultValue="exclude_winners"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclude_winners">Excluir ganadores anteriores</SelectItem><SelectItem value="include_winners">Permitir ganadores anteriores</SelectItem></SelectContent></Select></label><div className="flex flex-col gap-2 sm:col-span-3"><SubmitButton type="submit" pendingLabel="Guardando premio…">Guardar premio</SubmitButton><StateMessage state={state} /></div></form></section>{prizes.length ? prizes.map((prize) => <PrizeCard key={prize.id} eventId={event.id} raffleId={raffle.id} prize={prize} draws={draws} filterOptions={filterOptions} />) : <section className="rounded-2xl border border-border p-8 text-center"><p className="font-heading text-xl font-semibold">El tablero está listo</p><p className="mt-2 text-sm text-muted-foreground">Agrega el primer premio para habilitar los sorteos.</p></section>}<aside className="rounded-2xl border border-border bg-card/50 p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bitácora</p><h2 className="mt-1 font-heading text-xl font-semibold">Qué ha pasado</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Registro de cambios y acciones del equipo.</p>{audit.length ? <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{audit.toReversed().slice(0, 10).map((entry) => <li key={entry.id} className="border-l border-primary/40 pl-3"><p className="text-sm font-medium">{auditLabels[entry.action] ?? entry.action}</p><p className="mt-0.5 text-xs text-muted-foreground">{entry.actorEmail}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">Las acciones del equipo aparecerán aquí.</p>}</aside></div></main>;
}
