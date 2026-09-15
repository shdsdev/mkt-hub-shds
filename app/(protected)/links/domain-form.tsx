"use client";

import { useActionState } from "react";
import type { Domain } from "@/modules/links";
import { createDomainAction, type CreateDomainFormState } from "./actions";
import { BinaryLoader } from "@/components/binary-loader";

const initialState: CreateDomainFormState = {};

export function DomainForm({ domains }: { domains: Domain[] }) {
  const [state, formAction, pending] = useActionState(createDomainAction, initialState);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-heading font-medium">Dominios</h2>

      <ul className="space-y-1 text-sm text-muted-foreground">
        {domains.length === 0 && (
          <li>Aún no hay dominios — agrega uno para crear enlaces cortos.</li>
        )}
        {domains.map((domain) => (
          <li key={domain.id}>
            {domain.hostname} ·{" "}
            {domain.verificationStatus === "verified" ? "verificado" : "pendiente"}
          </li>
        ))}
      </ul>

      <form action={formAction} className="flex gap-2">
        <input
          name="hostname"
          required
          placeholder="go.example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
        >
          {pending ? <BinaryLoader /> : "Agregar"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
