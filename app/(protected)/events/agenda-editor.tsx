"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgendaItem } from "@/modules/events";

// Controlled array state serialized into one hidden input as JSON (agenda-fields.ts's
// `jsonArrayField` parses it server-side) — same "form owns a structured value via one hidden
// input" shape as the collectCompany/collectJobTitle "true"/"" pattern elsewhere in this form,
// just carrying a list instead of a boolean. Order is display order; there is no separate
// position field to keep in sync.
export function AgendaEditor({ initial }: { initial: AgendaItem[] }) {
  const [items, setItems] = useState<AgendaItem[]>(initial);

  function update(index: number, patch: Partial<AgendaItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Agenda</p>
      <input type="hidden" name="agenda" value={JSON.stringify(items)} />
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <Input
            value={item.time}
            onChange={(e) => update(index, { time: e.target.value })}
            placeholder="10:00 AM"
            className="w-28 shrink-0"
          />
          <Input
            value={item.title}
            onChange={(e) => update(index, { title: e.target.value })}
            placeholder="Título del bloque"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
          >
            Quitar
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setItems((prev) => [...prev, { time: "", title: "" }])}
      >
        Agregar bloque
      </Button>
    </div>
  );
}
