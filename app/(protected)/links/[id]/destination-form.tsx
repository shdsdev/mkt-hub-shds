"use client";

import { useActionState } from "react";
import { updateDestinationAction, type UpdateDestinationFormState } from "../actions";
import { BinaryLoader } from "@/components/binary-loader";

const initialState: UpdateDestinationFormState = {};

export function DestinationForm({
  linkId,
  destinationUrl,
  onSuccess,
}: {
  linkId: string;
  destinationUrl: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateDestinationAction, initialState);

  // When the form succeeds (no error), call onSuccess to close the modal
  if (state && !state.error && !pending && onSuccess) {
    // Use setTimeout to avoid calling during render
    setTimeout(onSuccess, 0);
  }

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
        {pending ? <BinaryLoader /> : "Guardar"}
      </button>
      {state.error && (
        <p role="alert" className="self-center text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
