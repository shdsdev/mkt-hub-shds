"use client";

import { useState } from "react";
import type { EventEmailContent } from "@/lib/events/event-email-content";

export function EventEmailContentFields({ initial }: { initial: EventEmailContent }) {
  const [content, setContent] = useState(initial);

  function update(field: keyof Omit<EventEmailContent, "version">, value: string) {
    setContent((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4 sm:col-span-2">
      <div>
        <p className="text-sm font-medium">Comunicación por correo</p>
        <p className="text-xs text-muted-foreground">
          Estos textos se reutilizan en la confirmación y en el recordatorio de 48 horas.
        </p>
      </div>
      <input type="hidden" name="emailContent" value={JSON.stringify(content)} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Introducción de confirmación
        <textarea
          value={content.confirmationIntro}
          onChange={(event) => update("confirmationIntro", event.target.value)}
          maxLength={1000}
          className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Introducción del recordatorio de 48 horas
        <textarea
          value={content.reminderIntro}
          onChange={(event) => update("reminderIntro", event.target.value)}
          maxLength={1000}
          className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Indicaciones logísticas
        <textarea
          value={content.logistics}
          onChange={(event) => update("logistics", event.target.value)}
          maxLength={2000}
          className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Beneficio o promoción
        <textarea
          value={content.benefit}
          onChange={(event) => update("benefit", event.target.value)}
          maxLength={2000}
          className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}
