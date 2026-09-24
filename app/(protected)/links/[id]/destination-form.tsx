"use client";

import { useActionState } from "react";
import type { ApplyableUtmTemplate } from "@/modules/utm";
import {
  updateDestinationAction,
  applyUtmTemplateAction,
  type UpdateDestinationFormState,
  type ApplyUtmTemplateFormState,
} from "../actions";
import { BinaryLoader } from "@/components/binary-loader";

const destinationInitialState: UpdateDestinationFormState = {};
const applyInitialState: ApplyUtmTemplateFormState = {};

export function DestinationForm({
  linkId,
  destinationUrl,
  templates = [],
  onSuccess,
}: {
  linkId: string;
  destinationUrl: string;
  templates?: ApplyableUtmTemplate[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateDestinationAction, destinationInitialState);
  const [applyState, applyFormAction, applyPending] = useActionState(
    applyUtmTemplateAction,
    applyInitialState,
  );

  // When the form succeeds (no error), call onSuccess to close the modal
  if (state && !state.error && !pending && onSuccess) {
    // Use setTimeout to avoid calling during render
    setTimeout(onSuccess, 0);
  }

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="linkId" value={linkId} />
        <input
          name="destinationUrl"
          type="url"
          defaultValue={destinationUrl}
          required
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? <BinaryLoader /> : "Guardar"}
        </button>
        {state.error && (
          <p role="alert" className="self-center text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>

      {templates.length > 0 && (
        <form action={applyFormAction} className="flex gap-2">
          <input type="hidden" name="linkId" value={linkId} />
          <select
            name="templateId"
            defaultValue=""
            aria-label="Aplicar plantilla UTM"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Aplicar plantilla UTM…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={applyPending}
            className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          >
            {applyPending ? <BinaryLoader /> : "Aplicar"}
          </button>
          {applyState.error && (
            <p role="alert" className="self-center text-sm text-destructive">
              {applyState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
