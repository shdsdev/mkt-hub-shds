"use client";

import { useActionState } from "react";
import { createLinkAction, type CreateLinkFormState } from "./actions";

const initialState: CreateLinkFormState = {};

export function LinkForm() {
  const [state, formAction, pending] = useActionState(createLinkAction, initialState);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="font-heading font-medium">New link</h2>

      <div className="space-y-1">
        <label htmlFor="destinationUrl" className="text-sm text-muted-foreground">
          Destination URL
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

      <div className="grid grid-cols-3 gap-2">
        <input
          name="utmSource"
          placeholder="utm_source"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          name="utmMedium"
          placeholder="utm_medium"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          name="utmCampaign"
          placeholder="utm_campaign"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

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
        {pending ? "Creating…" : "Create link"}
      </button>
    </form>
  );
}
