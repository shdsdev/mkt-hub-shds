"use client";

import { useActionState } from "react";
import type { ApplyableUtmTemplate } from "@/modules/utm";
import { createLinkAction, type CreateLinkFormState } from "./actions";
import { BinaryLoader } from "@/components/binary-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
          <Select name="templateId" defaultValue="">
            <SelectTrigger id="templateId" className="h-10 w-full">
              <SelectValue placeholder="Sin plantilla…" />
            </SelectTrigger>
            <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
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
