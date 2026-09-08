"use client";

import { useActionState } from "react";
import { updateDestinationAction, type UpdateDestinationFormState } from "../actions";

const initialState: UpdateDestinationFormState = {};

export function DestinationForm({ linkId, destinationUrl }: { linkId: string; destinationUrl: string }) {
  const [state, formAction, pending] = useActionState(updateDestinationAction, initialState);

  return (
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
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && (
        <p role="alert" className="self-center text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
