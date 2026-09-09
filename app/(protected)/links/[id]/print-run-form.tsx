"use client";

import { useActionState } from "react";
import { recordPrintRunAction, type RecordPrintRunFormState } from "../actions";

const initialState: RecordPrintRunFormState = {};

export function PrintRunForm({ shortLinkId, linkId }: { shortLinkId: string; linkId: string }) {
  const [state, formAction, pending] = useActionState(recordPrintRunAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="shortLinkId" value={shortLinkId} />
      <input type="hidden" name="linkId" value={linkId} />
      <input
        name="quantity"
        type="number"
        min={1}
        placeholder="Qty"
        required
        className="w-20 rounded-md border border-input bg-background px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground disabled:opacity-50"
      >
        {pending ? "…" : "Record print run"}
      </button>
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
