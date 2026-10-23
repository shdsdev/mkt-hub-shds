"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/checkbox";
import type { BenefitKind, BenefitRedemptionScope, BenefitRow } from "@/modules/events";
import { saveBenefitsConfigurationAction, type BenefitActionState } from "../benefits/actions";

type Props = {
  eventId: string;
  scope: BenefitRedemptionScope | null;
  scopeLocked: boolean;
  benefits: BenefitRow[];
  remainingByBenefitId?: Record<string, number>;
};

type EditableBenefit = {
  key: string;
  id?: string;
  kind: BenefitKind;
  name: string;
  percentage: number | null;
  quantity: number | null;
  active: boolean;
};

const initialState: BenefitActionState = {};

function toEditableBenefit(benefit: BenefitRow): EditableBenefit {
  return {
    key: benefit.id,
    id: benefit.id,
    kind: benefit.kind,
    name: benefit.name ?? "",
    percentage: benefit.percentage,
    quantity: benefit.quantity,
    active: benefit.active,
  };
}

function newBenefit(key: string): EditableBenefit {
  return { key, kind: "discount", name: "", percentage: null, quantity: null, active: true };
}

function ActionMessage({ state }: { state: BenefitActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if (state.success) return <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{state.success}</p>;
  return null;
}

function BenefitRowEditor({
  benefit,
  remaining,
  onChange,
  onRemove,
}: {
  benefit: EditableBenefit;
  remaining?: number;
  onChange: (patch: Partial<EditableBenefit>) => void;
  onRemove: () => void;
}) {
  const capped = benefit.quantity !== null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/30 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tipo de beneficio
          <Select value={benefit.kind} onValueChange={(value) => value && onChange({ kind: value as BenefitKind, name: value === "gift" ? benefit.name : "", percentage: value === "discount" ? benefit.percentage : null })}>
            <SelectTrigger aria-label="Tipo de beneficio" className="w-full">
              <SelectValue>{benefit.kind === "gift" ? "Regalo" : "Descuento"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="discount">Descuento</SelectItem>
              <SelectItem value="gift">Regalo</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {benefit.kind === "gift" ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Nombre del regalo
            <Input name="name" value={benefit.name} onChange={(event) => onChange({ name: event.target.value })} required aria-required="true" />
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Porcentaje de descuento
            <Input name="percentage" value={benefit.percentage ?? ""} onChange={(event) => onChange({ percentage: event.target.value === "" ? null : Number(event.target.value) })} type="number" min={0} max={100} step={1} required aria-required="true" />
          </label>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Checkbox checked={capped} onChange={(checked) => onChange({ quantity: checked ? 0 : null })} label="Cantidad limitada" />
        {capped ? (
          <label className="flex max-w-xs flex-col gap-1.5 text-sm font-medium">
            Cantidad máxima
            <Input name="quantity" value={benefit.quantity ?? ""} onChange={(event) => onChange({ quantity: event.target.value === "" ? null : Number(event.target.value) })} type="number" min={0} step={1} required aria-required="true" />
          </label>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {capped && benefit.id ? `Disponibles: ${remaining ?? benefit.quantity} de ${benefit.quantity}` : "Sin límite de unidades."}
        </p>
      </div>
      <Checkbox checked={benefit.active} onChange={(active) => onChange({ active })} label="Activo en el punto de canje" />
      <Button type="button" variant="outline" className="self-start" onClick={onRemove}>Quitar beneficio</Button>
    </div>
  );
}

export function EventBenefitsEditor({ eventId, scope, scopeLocked, benefits, remainingByBenefitId = {} }: Props) {
  const [state, action, pending] = useActionState(
    async (_state: BenefitActionState, formData: FormData) => saveBenefitsConfigurationAction(formData),
    initialState,
  );
  const [selectedScope, setSelectedScope] = useState<BenefitRedemptionScope>(scope ?? "attendee");
  const [rows, setRows] = useState<EditableBenefit[]>(() => benefits.length > 0 ? benefits.map(toEditableBenefit) : [newBenefit("new-0")]);

  function updateRow(key: string, patch: Partial<EditableBenefit>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="eventId" value={eventId} />
        <input
          type="hidden"
          name="configuration"
          value={JSON.stringify({
            scope: selectedScope,
            benefits: rows.map(({ id, ...benefit }) => ({ ...benefit, ...(id ? { id } : {}) })),
          })}
        />
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <h2 className="font-semibold">Configuración de beneficios</h2>
            <p className="text-sm text-muted-foreground">Define si cada persona o cada registro puede canjear una vez.</p>
          </div>
          <label className="flex w-full max-w-sm flex-col gap-1.5 text-sm font-medium">
            Alcance del canje
            <Select value={selectedScope} onValueChange={(value) => value && setSelectedScope(value as BenefitRedemptionScope)} disabled={scopeLocked}>
              <SelectTrigger aria-label="Alcance del canje" className="w-full">
                <SelectValue>{selectedScope === "registration" ? "Por registro" : "Por asistente"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendee">Por asistente</SelectItem>
                <SelectItem value="registration">Por registro</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {scopeLocked ? <p className="text-xs text-muted-foreground">El alcance está bloqueado porque ya existe un canje, incluso si luego se anula.</p> : null}
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Catálogo</h2>
            <p className="text-sm text-muted-foreground">Los beneficios activos aparecen disponibles para el equipo de recepción.</p>
          </div>
          {rows.map((benefit) => (
            <BenefitRowEditor
              key={benefit.key}
              benefit={benefit}
              remaining={benefit.id ? remainingByBenefitId[benefit.id] : undefined}
              onChange={(patch) => updateRow(benefit.key, patch)}
              onRemove={() => setRows((current) => current.filter((row) => row.key !== benefit.key))}
            />
          ))}
          <Button type="button" variant="secondary" className="self-start" onClick={() => setRows((current) => [...current, newBenefit(`new-${current.length}-${Date.now()}`)])}>
            Agregar beneficio
          </Button>
        </section>

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cambios"}</Button>
          <ActionMessage state={state} />
        </div>
      </form>
    </div>
  );
}
