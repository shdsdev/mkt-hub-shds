"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Domain } from "@/modules/links";
import { createShortLinkAction, type CreateShortLinkFormState } from "../actions";

const initialState: CreateShortLinkFormState = {};

export function ShortLinkForm({ linkId, domains }: { linkId: string; domains: Domain[] }) {
  const [state, formAction, pending] = useActionState(createShortLinkAction, initialState);

  if (domains.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a domain on the <Link href="/links" className="text-accent hover:underline">Links</Link> page
        before creating a short link.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="linkId" value={linkId} />

      <div className="space-y-1">
        <label htmlFor="domainId" className="text-xs text-muted-foreground">
          Domain
        </label>
        <select
          id="domainId"
          name="domainId"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {domain.hostname}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="slug" className="text-xs text-muted-foreground">
          Slug (optional — auto-generated if empty)
        </label>
        <input
          id="slug"
          name="slug"
          placeholder="auto"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create short link"}
      </button>

      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
