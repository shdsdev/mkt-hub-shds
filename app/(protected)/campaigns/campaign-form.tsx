"use client";

import { useActionState } from "react";
import { createCampaignAction, type CreateCampaignFormState } from "./actions";

const initialState: CreateCampaignFormState = {};

export function CampaignForm() {
  const [state, formAction, pending] = useActionState(createCampaignAction, initialState);

  return (
    <form action={formAction} className="flex gap-2">
      <input
        name="name"
        required
        placeholder="Spring launch"
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create campaign"}
      </button>
      {state.error && (
        <p role="alert" className="self-center text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
