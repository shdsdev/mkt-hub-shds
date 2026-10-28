"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmailSegment, EmailSegmentCondition } from "@/modules/email-marketing";
import { segmentFieldLabels, segmentOperatorLabels } from "./segment-presentation";
import {
  createEmailSegmentAction,
  previewEmailSegmentAction,
  updateEmailSegmentAction,
  type SegmentActionState,
} from "./actions";

type Field = EmailSegmentCondition["field"];
type Operator = EmailSegmentCondition["operator"];
type Rule = { id: string; field: Field; operator: Operator; value: string };

function operatorsFor(field: Field): Operator[] {
  if (field === "tag" || field === "event") return ["has", "not_has"];
  if (field === "subscriptionStatus") return ["equals", "not_equals"];
  return ["contains", "not_contains", "equals", "not_equals", "is_empty", "is_not_empty"];
}

function makeRule(): Rule {
  return { id: crypto.randomUUID(), field: "fullName", operator: "contains", value: "" };
}

function rulesFromSegment(segment?: EmailSegment): Rule[] {
  const conditions = segment?.definition.filters.conditions;
  if (!conditions?.length) return [makeRule()];
  return conditions.map((condition) => ({ ...condition, id: crypto.randomUUID() }));
}

export function SegmentBuilder({ segment, onCancel }: { segment?: EmailSegment; onCancel: () => void }) {
  const [rules, setRules] = useState<Rule[]>(() => rulesFromSegment(segment));
  const [logic, setLogic] = useState<"all" | "any">(segment?.definition.filters.logic ?? "all");
  const [name, setName] = useState(segment?.name ?? "");
  const [reviewedSignature, setReviewedSignature] = useState("");
  const [previewState, previewAction, previewPending] = useActionState<SegmentActionState, FormData>(previewEmailSegmentAction, {});
  const [saveState, saveAction, savePending] = useActionState<SegmentActionState, FormData>(segment ? updateEmailSegmentAction : createEmailSegmentAction, {});
  const router = useRouter();
  const definition = useMemo(() => ({ version: 1 as const, filters: { logic, conditions: rules.map(({ field, operator, value }) => ({ field, operator, value })) } }), [logic, rules]);
  const signature = JSON.stringify(definition);
  const showingReview = previewState.matches !== undefined && reviewedSignature === signature;

  useEffect(() => {
    if (saveState.success) {
      router.refresh();
      onCancel();
    }
  }, [onCancel, router, saveState.success]);

  function updateRule(id: string, changes: Partial<Rule>) {
    setRules((current) => current.map((rule) => {
      if (rule.id !== id) return rule;
      const next = { ...rule, ...changes };
      if (changes.field && changes.field !== rule.field) next.operator = operatorsFor(changes.field)[0];
      return next;
    }));
    setReviewedSignature("");
  }

  function addRule() {
    setRules((current) => [...current, makeRule()]);
    setReviewedSignature("");
  }

  function removeRule(id: string) {
    setRules((current) => current.length === 1 ? current : current.filter((rule) => rule.id !== id));
    setReviewedSignature("");
  }

  function duplicateRule(rule: Rule) {
    setRules((current) => [...current, { ...rule, id: crypto.randomUUID() }]);
    setReviewedSignature("");
  }

  return (
    <section className="space-y-7">
      <button type="button" onClick={onCancel} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} /> Volver a segmentos
      </button>
      {!showingReview ? (
        <form action={previewAction} onSubmit={() => setReviewedSignature(signature)} className="space-y-7">
          <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">{segment ? "Editar segmento" : "Nuevo segmento"}</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold">¿A quién querés enviarle?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Definí las condiciones de tu audiencia. Podés combinar varias reglas y reutilizarlas en tus campañas.</p>
            </div>
            <label className="block w-full text-sm font-medium sm:max-w-xs">
              Nombre del segmento
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ej. Clientes de showroom" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
            </label>
          </div>
          <input type="hidden" name="definition" value={JSON.stringify(definition)} readOnly />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Incluir contactos que cumplan</span>
            <Select value={logic} onValueChange={(value) => { setLogic((value ?? "all") as typeof logic); setReviewedSignature(""); }}>
              <SelectTrigger size="sm" className="w-auto"><SelectValue>{logic === "all" ? "todas las reglas" : "cualquier regla"}</SelectValue></SelectTrigger>
              <SelectContent><SelectItem value="all">todas las reglas</SelectItem><SelectItem value="any">cualquier regla</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {rules.map((rule, index) => (
              <div key={rule.id} className="grid gap-3 rounded-xl border border-border bg-background/30 p-3 sm:grid-cols-[1.5rem_minmax(0,1.1fr)_minmax(0,.9fr)_minmax(0,1.5fr)_auto] sm:items-center">
                <span className="text-xs text-muted-foreground">{index + 1}</span>
                <Select value={rule.field} onValueChange={(value) => updateRule(rule.id, { field: value as Field })}>
                  <SelectTrigger className="w-full"><SelectValue>{segmentFieldLabels[rule.field]}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(segmentFieldLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={rule.operator} onValueChange={(value) => updateRule(rule.id, { operator: value as Operator })}>
                  <SelectTrigger className="w-full"><SelectValue>{segmentOperatorLabels[rule.operator]}</SelectValue></SelectTrigger>
                  <SelectContent>{operatorsFor(rule.field).map((value) => <SelectItem key={value} value={value}>{segmentOperatorLabels[value]}</SelectItem>)}</SelectContent>
                </Select>
                {rule.operator !== "is_empty" && rule.operator !== "is_not_empty" ? <input value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="Escribí un valor" className="h-9 min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /> : <span className="text-xs text-muted-foreground">No necesita un valor</span>}
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => duplicateRule(rule)} aria-label="Duplicar regla" className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"><Copy size={14} /></button>
                  <button type="button" onClick={() => removeRule(rule.id)} disabled={rules.length === 1} aria-label="Eliminar regla" className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center">
            <button type="button" onClick={addRule} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><Plus size={15} /> Añadir otra condición</button>
            <p className="text-xs text-muted-foreground sm:ml-auto">Las bajas y supresiones siempre quedan fuera de los envíos.</p>
          </div>
          {previewState.error ? <p role="alert" className="text-sm text-destructive">{previewState.error}</p> : null}
          <div className="flex justify-end"><button type="submit" disabled={previewPending || !name.trim() || rules.some((rule) => !rule.value && !["is_empty", "is_not_empty"].includes(rule.operator))} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{previewPending ? "Revisando…" : "Revisar audiencia"}</button></div>
        </form>
      ) : (
        <div className="space-y-6">
          <button type="button" onClick={() => setReviewedSignature("")} className="text-sm text-primary hover:underline">← Volver a editar condiciones</button>
          <div className="border-b border-border pb-5"><p className="text-sm font-medium text-primary">Revisión</p><h2 className="mt-2 font-heading text-2xl font-semibold">Así quedará tu audiencia</h2><p className="mt-2 text-sm text-muted-foreground">{rules.map((rule) => `${segmentFieldLabels[rule.field]} ${segmentOperatorLabels[rule.operator]}${rule.value ? ` ${rule.value}` : ""}`).join(logic === "all" ? " · Y · " : " · O · ")}</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="border-b border-border pb-4"><p className="text-4xl font-semibold">{previewState.matches}</p><p className="mt-1 text-sm text-muted-foreground">contactos encontrados</p></div><div className="border-b border-border pb-4"><p className="text-4xl font-semibold">{previewState.eligible}</p><p className="mt-1 text-sm text-muted-foreground">podrán recibir campañas</p></div></div>
          <div><p className="font-medium">Una muestra de esta audiencia</p>{previewState.sample?.length ? <ul className="mt-3 divide-y divide-border border-y border-border">{previewState.sample.map((contact) => <li key={contact.email} className="flex justify-between gap-4 py-3 text-sm"><span>{contact.fullName || "Sin nombre"}</span><span className="text-muted-foreground">{contact.email}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Ningún contacto coincide con estas condiciones.</p>}</div>
          <form action={saveAction} className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-end"><input type="hidden" name="definition" value={JSON.stringify(definition)} readOnly />{segment ? <input type="hidden" name="segmentId" value={segment.id} readOnly /> : null}<label className="flex-1 text-sm font-medium">Nombre del segmento<input name="name" value={name} onChange={(event) => setName(event.target.value)} required className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label><button type="submit" disabled={savePending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"><Check size={15} />{savePending ? "Guardando…" : segment ? "Guardar cambios" : "Guardar segmento"}</button></form>
          {saveState.error ? <p role="alert" className="text-sm text-destructive">{saveState.error}</p> : null}
        </div>
      )}
    </section>
  );
}
