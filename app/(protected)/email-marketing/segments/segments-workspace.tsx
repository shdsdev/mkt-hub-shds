"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import type { EmailSegment } from "@/modules/email-marketing";
import { describeSegmentFilters } from "./segment-presentation";
import { deleteEmailSegmentAction, duplicateEmailSegmentAction } from "./actions";
import { SegmentBuilder } from "./segment-builder";

type SegmentRow = EmailSegment & { eligibleContactCount: number };

export function SegmentsWorkspace({ segments }: { segments: SegmentRow[] }) {
  const [editingSegment, setEditingSegment] = useState<EmailSegment>();
  const [isCreating, setIsCreating] = useState(false);
  const isBuilderOpen = isCreating || Boolean(editingSegment);

  if (isBuilderOpen) {
    return (
      <SegmentBuilder
        key={editingSegment?.id ?? "new"}
        segment={editingSegment}
        onCancel={() => { setEditingSegment(undefined); setIsCreating(false); }}
      />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Tus segmentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Audiencias que puedes volver a usar en cualquier campaña.</p>
        </div>
        <button type="button" onClick={() => setIsCreating(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Plus size={16} /> Crear segmento
        </button>
      </div>

      {segments.length === 0 ? (
        <div className="border border-dashed border-border px-6 py-14 text-center">
          <p className="font-heading text-lg font-semibold">Crea tu primera audiencia</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Elige condiciones como etiquetas, empresa o estado de suscripción para enviar campañas más relevantes.</p>
          <button type="button" onClick={() => setIsCreating(true)} className="mt-5 text-sm font-medium text-primary hover:underline">Crear un segmento</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr><th className="px-3 py-3 font-medium">Nombre</th><th className="px-3 py-3 font-medium">Condiciones</th><th className="px-3 py-3 font-medium">Audiencia</th><th className="px-3 py-3 text-right font-medium">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {segments.map((segment) => (
                <tr key={segment.id} className="group transition-colors hover:bg-muted/15">
                  <td className="px-3 py-5 align-top"><p className="font-medium">{segment.name}</p><p className="mt-1 text-xs text-muted-foreground">Actualizado {new Date(segment.updatedAt).toLocaleDateString("es-MX")}</p></td>
                  <td className="max-w-[360px] px-3 py-5 align-top text-muted-foreground">{describeSegmentFilters(segment.definition.filters)}</td>
                  <td className="px-3 py-5 align-top"><span className="font-medium text-foreground">{segment.eligibleContactCount}</span><span className="ml-1 text-xs text-muted-foreground">contactos habilitados</span></td>
                  <td className="px-3 py-5 align-top"><div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingSegment(segment)} className="inline-flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"><Pencil size={13} /> Editar</button>
                    <form action={duplicateEmailSegmentAction}><input type="hidden" name="segmentId" value={segment.id} /><button type="submit" aria-label={`Duplicar ${segment.name}`} className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"><Copy size={14} /></button></form>
                    <form action={deleteEmailSegmentAction}><input type="hidden" name="segmentId" value={segment.id} /><button type="submit" aria-label={`Eliminar ${segment.name}`} className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></form>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
