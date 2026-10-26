"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, ChevronDown, CircleHelp, Clock3, Info, LoaderCircle, Minus, Pause, Play, Plus, Sparkles, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip } from "@/components/tooltip";
import {
  claimDrawAction,
  createPrizeAction,
  decreasePrizeQuantityAction,
  drawNextPrizeAction,
  drawPrizeAction,
  increasePrizeQuantityAction,
  invalidateDrawAction,
  rotateRaffleStageTokenAction,
  togglePrizeAction,
  updateRaffleDrawModeAction,
  type RaffleActionState,
} from "./actions";
import type { RaffleAuditRow, RaffleDrawRow, RafflePrizeRow, RaffleRow } from "@/modules/raffles";
import { getRaffleFilterOptions } from "@/lib/events/raffle-filter-labels";
import { StageThemeSettings } from "./stage-theme-settings";
import type { RaffleStageTheme } from "@/lib/raffle-stage-theme";

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

function drawStatusBadgeClass(status: string) {
  if (status === "claimed") return "border-primary bg-primary text-primary-foreground";
  if (status === "invalidated") return "border-destructive/40 bg-destructive/15 text-destructive";
  return "border-border bg-background/40 text-muted-foreground";
}

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

function auditLabel(entry: RaffleAuditRow) {
  if (entry.action === "status_change" && entry.metadata?.change === "draw_mode") return "Modo de sorteo actualizado";
  return auditLabels[entry.action] ?? entry.action;
}

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

function SubmitButton({ children, pendingLabel = "Procesando…", pendingContent, ...props }: React.ComponentProps<typeof Button> & { pendingLabel?: string; pendingContent?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <Button {...props} disabled={pending || props.disabled}>{pending ? pendingContent ?? pendingLabel : children}</Button>;
}

function StateMessage({ state, className = "" }: { state: RaffleActionState; className?: string }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? "alert" : "status"} className={`mt-3 break-words text-sm ${state.error ? "text-destructive" : "text-accent"} ${className}`}>{state.error ?? state.success}</p>;
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
          <div className="flex w-full shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2 sm:w-56">
           <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
           <span className="sr-only">Hora límite</span>
           <div className="min-w-0 flex-1">
             <Select value={hour12} onValueChange={(value) => updateHour(value ?? hour12)}>
               <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-transparent px-1 shadow-none" aria-label="Hora límite de reclamo"><SelectValue /></SelectTrigger>
               <SelectContent>{Array.from({ length: 12 }, (_, index) => { const value = String(index + 1).padStart(2, "0"); return <SelectItem key={value} value={value}>{value}</SelectItem>; })}</SelectContent>
             </Select>
           </div>
           <span aria-hidden="true">:</span>
           <div className="min-w-0 flex-1">
             <Select value={minute} onValueChange={(value) => setTime(`${hour24}:${value ?? minute}`)}>
               <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-transparent px-1 shadow-none" aria-label="Minutos límite de reclamo"><SelectValue /></SelectTrigger>
               <SelectContent>{Array.from({ length: 12 }, (_, index) => { const value = String(index * 5).padStart(2, "0"); return <SelectItem key={value} value={value}>{value}</SelectItem>; })}</SelectContent>
             </Select>
           </div>
           <div className="min-w-0 flex-[1.25]">
             <Select value={period} onValueChange={(value) => updateHour(hour12, value ?? period)}>
               <SelectTrigger className="h-8 w-full min-w-0 border-0 bg-transparent px-1 shadow-none" aria-label="Periodo de la hora límite"><SelectValue /></SelectTrigger>
               <SelectContent><SelectItem value="am">a. m.</SelectItem><SelectItem value="pm">p. m.</SelectItem></SelectContent>
             </Select>
           </div>
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
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${drawStatusBadgeClass(draw.status)}`}>{statusLabels[draw.status] ?? draw.status}</span>
        {draw.status === "claimed" && <form action={claimAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><SubmitButton size="sm" variant="outline" type="submit" pendingLabel="Reenviando…">Reenviar correo</SubmitButton></form>}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {(draw.status === "pending_reveal" || draw.status === "revealed") && <form action={claimAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><SubmitButton size="sm" variant="secondary" type="submit" pendingLabel="Confirmando y enviando…">Confirmar ganador y enviar correo</SubmitButton></form>}
      {!( ["claimed", "invalidated", "unclaimed"].includes(draw.status)) && <form action={invalidateAction} className="flex min-w-[min(100%,22rem)] flex-1 gap-2"><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="drawId" value={draw.id} /><Input name="reason" placeholder="Motivo para invalidar" aria-label="Motivo para invalidar" required /><SubmitButton size="sm" variant="destructive" type="submit">Invalidar</SubmitButton></form>}
    </div>
    <StateMessage state={state} />
  </article>;
}

function DrawModeSettings({ eventId, raffleId, drawMode }: { eventId: string; raffleId: string; drawMode: "manual" | "automatic" }) {
  const [state, action] = useActionState(updateRaffleDrawModeAction, {});
  const [open, setOpen] = useState(false);

  return <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm sm:p-6">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
      <span>
        <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-primary">Control de sorteo</span>
        <span className="mt-1 block font-heading text-2xl font-semibold">¿Cómo querés elegir el próximo premio?</span>
        <span className="mt-2 block max-w-2xl text-sm leading-6 text-muted-foreground">Podés cambiar este modo en cualquier momento. El cambio solo aplica al próximo sorteo y no modifica resultados anteriores.</span>
      </span>
      <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    <div hidden={!open} role="radiogroup" aria-label="Modo de sorteo" className="mt-5 grid gap-3 lg:grid-cols-2">
      {([
        { value: "manual" as const, title: "Elegir premio manualmente", description: "Seleccioná desde la lista qué premio querés sortear ahora.", tooltip: "Usá este modo cuando quieras decidir el orden de los premios o saltear uno.", button: "Usar modo Manual" },
        { value: "automatic" as const, title: "Sortear siguiente premio", description: "El sistema toma el primer premio pendiente según el orden configurado.", tooltip: "Usá este modo cuando quieras respetar el orden de la lista sin elegir un premio cada vez.", button: "Usar modo Automático" },
      ]).map((option) => {
        const selected = drawMode === option.value;
        return <form key={option.value} action={action} className={`rounded-xl border p-4 transition ${selected ? "border-accent bg-accent/10" : "border-border/70 bg-background/20"}`}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="raffleId" value={raffleId} />
          <input type="hidden" name="drawMode" value={option.value} />
          <button type="submit" role="radio" aria-checked={selected} disabled={selected} className="flex w-full items-start gap-3 text-left disabled:cursor-default">
            <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-accent" : "border-muted-foreground/50"}`}><span className={`size-2.5 rounded-full bg-accent transition ${selected ? "scale-100" : "scale-0"}`} /></span>
            <span className="min-w-0"><span className="flex items-center gap-2 font-semibold">{option.title}<Tooltip label={option.tooltip}><CircleHelp className="size-3.5 text-muted-foreground" aria-hidden="true" /></Tooltip></span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{option.description}</span><span className="mt-3 block text-xs font-semibold text-primary">{selected ? "Modo seleccionado" : option.button}</span></span>
          </button>
        </form>;
      })}
    </div>
    <StateMessage state={state} />
  </section>;
}

function nextAvailablePrize(prizes: RafflePrizeRow[]) {
  return prizes.find((prize) => prize.status !== "paused" && prize.status !== "finished" && prize.drawnQuantity < prize.quantity);
}

function AutomaticDrawControl({ eventId, prizes, draws }: { eventId: string; prizes: RafflePrizeRow[]; draws: RaffleDrawRow[] }) {
  const [state, action] = useRaffleAction(drawNextPrizeAction);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const nextPrize = nextAvailablePrize(prizes);
  const hasPendingDraw = draws.some((draw) => draw.status === "pending_reveal" || draw.status === "revealed");

  return <section className="light-raffle-surface rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Modo automático activo</p>
        <h2 className="mt-1 font-heading text-2xl font-semibold">{nextPrize ? nextPrize.name : "No hay premios pendientes"}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Al confirmar, se sortea el primer premio pendiente de la lista. El proyector detectará el resultado y mostrará la animación.</p>
      </div>
      <form action={action} className="shrink-0">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <SubmitButton type="submit" disabled={!nextPrize || hasPendingDraw} pendingLabel="Sorteando…">{hasPendingDraw ? "Confirma el resultado anterior" : "Sortear siguiente premio"}</SubmitButton>
      </form>
    </div>
    {!nextPrize ? <p className="mt-4 text-sm font-medium text-muted-foreground">Todos los premios disponibles ya fueron sorteados o están pausados.</p> : null}
    <StateMessage state={state} />
  </section>;
}

function PrizeCard({ eventId, raffleId, prize, draws, filterOptions, drawMode }: { eventId: string; raffleId: string; prize: RafflePrizeRow; draws: RaffleDrawRow[]; filterOptions: FilterOptions; drawMode: "manual" | "automatic" }) {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toggleState, toggleAction] = useRaffleAction(togglePrizeAction);
  const [quantityState, quantityAction] = useRaffleAction(increasePrizeQuantityAction);
  const [decreaseQuantityState, decreaseQuantityAction] = useRaffleAction(decreasePrizeQuantityAction);
  const [drawState, drawAction] = useRaffleAction(drawPrizeAction);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const prizeDraws = draws.filter((draw) => draw.prizeId === prize.id).toReversed();
  const isPaused = prize.status === "paused";

  return <section className="light-raffle-surface overflow-hidden rounded-2xl border border-border bg-card/70 shadow-sm">
    <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${isPaused ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"}`}><Sparkles className="size-4" aria-hidden="true" /></span>
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-accent px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">Premio</span><span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{statusLabels[prize.status]}</span></span><span className="mt-2 block truncate font-heading text-xl font-semibold tracking-tight">{prize.name}</span><span className="mt-1 block text-sm text-muted-foreground">{prize.drawnQuantity} de {prize.quantity} unidades sorteadas</span></span>
        <ChevronDown className={`ml-auto size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <form action={toggleAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="raffleId" value={raffleId} /><input type="hidden" name="prizeId" value={prize.id} /><input type="hidden" name="status" value={isPaused ? "ready" : "paused"} /><SubmitButton type="submit" size="icon" variant="outline" disabled={prize.status === "finished"} aria-label={isPaused ? "Reanudar premio" : "Pausar premio"} title={isPaused ? "Reanudar premio" : "Pausar premio"} pendingContent={<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}>{isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}</SubmitButton></form>
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/30 p-1">
          <form action={decreaseQuantityAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="raffleId" value={raffleId} /><input type="hidden" name="prizeId" value={prize.id} /><input type="hidden" name="amount" value="1" /><SubmitButton type="submit" size="icon" variant="ghost" disabled={prize.quantity <= prize.drawnQuantity} aria-label="Quitar una unidad" title="Quitar una unidad" pendingContent={<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}><Minus className="size-4" /></SubmitButton></form>
          <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-label={`${prize.quantity} unidades`}>{prize.quantity}</span>
          <form action={quantityAction}><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="raffleId" value={raffleId} /><input type="hidden" name="prizeId" value={prize.id} /><input type="hidden" name="amount" value="1" /><SubmitButton type="submit" size="icon" variant="ghost" aria-label="Agregar una unidad" title="Agregar una unidad" pendingContent={<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}><Plus className="size-4" /></SubmitButton></form>
        </div>
      </div>
    </header>
    {open ? <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
        <div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-background/20">
          <div className="grid gap-1 p-4"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condiciones</span><p className="text-sm leading-6">{prize.conditions || "Sin condiciones adicionales."}</p></div>
          <div className="grid gap-1 p-4"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entrega</span><p className="text-sm leading-6">{prize.fulfillmentContact || "Sin contacto definido."}</p></div>
          <div className="grid gap-1 p-4"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cómo reclamar</span><p className="text-sm leading-6">{prize.instructions || "Sin instrucciones adicionales."}</p><p className="text-xs text-muted-foreground">Límite: {formatDate(prize.claimDeadlineAt)}</p></div>
        </div>
        {drawMode === "manual" ? <form action={drawAction} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="prizeId" value={prize.id} /><input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <h3 className="font-medium">Sortear otra unidad</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Sin filtros participan todos los asistentes activos que hicieron check-in.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><FilterSelect name="occupation" label="Ocupación" filterName="occupation" options={filterOptions.occupations} /><FilterSelect name="clientBrands" label="Marca" filterName="clientBrands" options={filterOptions.clientBrands} /><FilterSelect name="interests" label="Interés" filterName="interests" options={filterOptions.interests} /></div>
          <div className="mt-4 flex flex-wrap items-center gap-3"><SubmitButton className="w-full sm:w-auto" type="submit" disabled={isPaused || prize.status === "finished"} pendingLabel="Sorteando…">Sortear ganador</SubmitButton><span className="text-xs text-muted-foreground">Puedes ajustar los filtros antes de cada unidad.</span></div>
          <StateMessage state={drawState} />
        </form> : <div className="rounded-xl border border-border/70 bg-background/30 p-4"><h3 className="font-medium">Sorteo automático</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Este premio se sorteará desde el control «Sortear siguiente premio» cuando llegue su turno.</p></div>}
      <section className="rounded-xl border border-border/70 bg-background/30 p-4 lg:col-span-2">
        <button type="button" onClick={() => setHistoryOpen((value) => !value)} aria-expanded={historyOpen} className="flex w-full items-center justify-between gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
          <span>
            <span className="block text-sm font-semibold">Historial de ganadores</span>
            <span className="mt-1 block text-xs text-muted-foreground">{prizeDraws.length ? "Consulta o gestiona los resultados de este premio." : "Todavía no hay ganadores para este premio."}</span>
          </span>
          <span className="flex items-center gap-3">
            <span className="min-w-10 rounded-full bg-primary px-3 py-1 text-center text-sm font-bold text-primary-foreground">{prizeDraws.length}</span>
            <ChevronDown className={`size-5 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </button>
        <div hidden={!historyOpen} className="mt-4 grid gap-3 border-t border-border/70 pt-4">
          {prizeDraws.length ? prizeDraws.map((draw) => <DrawRow key={draw.id} eventId={eventId} draw={draw} />) : <p className="py-4 text-sm text-muted-foreground">El primer resultado aparecerá aquí después de realizar un sorteo.</p>}
        </div>
      </section>
    </div> : null}
    <StateMessage className="px-5 pb-5" state={toggleState.error ? toggleState : quantityState.error || quantityState.success ? quantityState : decreaseQuantityState} />
  </section>;
}

function NewPrizeModal({ eventId, raffleId }: { eventId: string; raffleId: string }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [state, action] = useActionState(createPrizeAction, {});

  useEffect(() => {
    if (open && submitted && state.success) {
      setOpen(false);
      setSubmitted(false);
    }
  }, [open, state.success, submitted]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setSubmitted(false);
  }

  return <Dialog.Root open={open} onOpenChange={handleOpenChange}>
    <Dialog.Trigger render={<Button type="button">Nuevo premio</Button>} />
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/65" />
      <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex h-fit max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100vh-4rem)] sm:w-[min(56rem,calc(100vw-4rem))]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <Dialog.Title className="font-heading text-2xl font-semibold">Nuevo premio</Dialog.Title>
            <p className="mt-1 text-sm text-muted-foreground">Define qué se entrega, cómo se reclama y hasta cuándo.</p>
          </div>
          <Dialog.Close render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Cerrar nuevo premio"><X className="size-4" /></Button>} />
        </div>

        <form action={action} onSubmit={() => setSubmitted(true)} className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="raffleId" value={raffleId} />

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="grid gap-4 sm:col-span-3 sm:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)]">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Nombre del premio</span>
                <Input name="name" placeholder="Ej. Experiencia gastronómica" required />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Cantidad de unidades</span>
                <Input name="quantity" type="number" min="1" placeholder="1" required />
              </label>
            </div>

            <DateTimeField />

            <div className="grid gap-4 sm:col-span-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Contacto de entrega</span>
                <Input name="fulfillmentContact" placeholder="Ej. Ana · premios@shades.com · 33 1234 5678" />
                <span className="text-xs text-muted-foreground">Quién puede resolver dudas o entregar el premio.</span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Cómo reclamar</span>
                <textarea name="instructions" className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Ej. Presenta tu código en recepción antes de la fecha límite." />
                <span className="text-xs text-muted-foreground">Describe el paso concreto que debe seguir la persona ganadora.</span>
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-3">
              <span className="font-medium">Condiciones</span>
              <textarea name="conditions" className="min-h-20 rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Ej. Válido solo para asistentes con check-in confirmado." />
              <span className="text-xs text-muted-foreground">Restricciones, ubicación, documentación o requisitos especiales.</span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-3">
              <span className="flex items-center gap-1.5 font-medium">
                Política de ganadores
                <Tooltip label="Excluir evita que la misma persona gane este premio más de una vez. Incluir permite volver a seleccionarla.">
                  <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </Tooltip>
              </span>
              <Select name="winnerPolicy" defaultValue="exclude_winners">
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exclude_winners">Excluir ganadores anteriores</SelectItem>
                  <SelectItem value="include_winners">Permitir ganadores anteriores</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <div className="flex flex-col gap-2 sm:col-span-3">
              <SubmitButton type="submit" pendingLabel="Guardando premio…">Guardar premio</SubmitButton>
              <StateMessage state={state} />
            </div>
          </div>
        </form>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function RaffleManagement({ event, raffle, prizes, draws, audit, filterOptions, organizationId, stageTheme }: { event: Event; raffle: RaffleRow; prizes: RafflePrizeRow[]; draws: RaffleDrawRow[]; audit: RaffleAuditRow[]; filterOptions: FilterOptions; organizationId: string; stageTheme: RaffleStageTheme }) {
  const [stageState, stageAction] = useActionState(rotateRaffleStageTokenAction, {});

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 pb-10 sm:px-6">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Control de sorteo · {statusLabels[raffle.status]}</p>
          <h1 className="mt-2 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{event.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Configura premios, define quién participa y controla cada ganador con trazabilidad clara.</p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
              <div><p className="text-2xl font-semibold">{prizes.length}</p><p className="text-xs text-muted-foreground">Premios</p></div>
              <div><p className="text-2xl font-semibold">{draws.filter((draw) => draw.status !== "invalidated").length}</p><p className="text-xs text-muted-foreground">Resultados válidos</p></div>
              <div><p className="text-2xl font-semibold">{audit.length}</p><p className="text-xs text-muted-foreground">Eventos auditados</p></div>
            </div>
            <form action={stageAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="eventId" value={event.id} />
              <SubmitButton type="submit" variant="secondary" pendingLabel="Generando…">Generar enlace de escenario</SubmitButton>
              {stageState.stageUrl ? <a className={buttonVariants({ variant: "default", className: "bg-[#242424] text-white hover:bg-[#393e41]" })} href={stageState.stageUrl} target="_blank" rel="noreferrer" title="Abre la pantalla pública para proyectar el sorteo">Abrir pantalla</a> : null}
            </form>
            <p className="max-w-md text-xs leading-5 text-muted-foreground">Genera un enlace público para proyectar el sorteo. Después selecciona «Abrir pantalla» en una pantalla del auditorio.</p>
          </div>
          <StateMessage state={stageState} />
        </div>
      </header>

      <div className="space-y-7">
        <StageThemeSettings eventId={event.id} raffleId={raffle.id} organizationId={organizationId} theme={stageTheme} />
        <DrawModeSettings eventId={event.id} raffleId={raffle.id} drawMode={raffle.drawMode} />
        {raffle.drawMode === "automatic" ? <AutomaticDrawControl eventId={event.id} prizes={prizes} draws={draws} /> : null}
        <div className="flex justify-end">
          <NewPrizeModal eventId={event.id} raffleId={raffle.id} />
        </div>
        {prizes.length ? prizes.map((prize) => <PrizeCard key={prize.id} eventId={event.id} raffleId={raffle.id} prize={prize} draws={draws} filterOptions={filterOptions} drawMode={raffle.drawMode} />) : <section className="rounded-2xl border border-border p-8 text-center"><p className="font-heading text-xl font-semibold">El tablero está listo</p><p className="mt-2 text-sm text-muted-foreground">Usa «Nuevo premio» para agregar el primero.</p></section>}
        <aside className="rounded-2xl border border-border bg-card/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bitácora</p>
          <h2 className="mt-1 font-heading text-xl font-semibold">Qué ha pasado</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Registro de cambios y acciones del equipo.</p>
          {audit.length ? <ol className="mt-5 overflow-hidden rounded-xl border border-border/70 bg-background/30 px-4 font-mono text-xs">{audit.toReversed().slice(0, 10).map((entry) => <li key={entry.id} className="grid gap-1 border-b border-border/60 py-3 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4"><time className="text-muted-foreground" dateTime={new Date(entry.createdAt).toISOString()}>{formatDate(entry.createdAt)}</time><span className="font-semibold text-foreground">{auditLabel(entry)}</span><span className="truncate text-muted-foreground">{entry.actorEmail}</span></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">Las acciones del equipo aparecerán aquí.</p>}
        </aside>
      </div>
    </main>
  );
}
