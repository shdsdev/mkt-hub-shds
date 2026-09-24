"use client";

import { useActionState } from "react";
import type { ApplyableUtmTemplate } from "@/modules/utm";
import { createLinkAction, type CreateLinkFormState } from "./actions";
import { BinaryLoader } from "@/components/binary-loader";

const initialState: CreateLinkFormState = {};

export function LinkForm({ templates }: { templates: ApplyableUtmTemplate[] }) {
  const [state, formAction, pending] = useActionState(createLinkAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="font-heading font-medium">Nuevo enlace</h2>

      <div className="space-y-1">
        <label htmlFor="destinationUrl" className="text-sm text-muted-foreground">
          URL de destino
        </label>
        <input
          id="destinationUrl"
          name="destinationUrl"
          type="url"
          required
          placeholder="https://example.com/page"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {templates.length > 0 && (
        <div className="space-y-1">
          <label htmlFor="templateId" className="text-sm text-muted-foreground">
            Plantilla UTM (opcional — aplica sus parámetros al destino)
          </label>
          <select
            id="templateId"
            name="templateId"
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin plantilla…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? <BinaryLoader /> : "Crear enlace"}
      </button>
    </form>
  );
}
