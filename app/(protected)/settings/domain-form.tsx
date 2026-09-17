"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2, Check } from "lucide";
import type { Domain } from "@/modules/links";
import {
  createDomainAction,
  updateDomainAction,
  deleteDomainAction,
  type CreateDomainFormState,
  type UpdateDomainFormState,
  type DeleteDomainFormState,
} from "./actions";
import { BinaryLoader } from "@/components/binary-loader";
import { HoverMorphIcon } from "@/components/hover-morph-icon";

const createInitialState: CreateDomainFormState = {};
const updateInitialState: UpdateDomainFormState = {};
const deleteInitialState: DeleteDomainFormState = {};

// Every short link/QR resolves through one of these hostnames — moved here from the Enlaces page
// because it's org-wide configuration, not a per-link action. Each row owns its own edit toggle
// and useActionState instances (one per row, not shared), so editing one domain never disturbs
// another's pending/error state.
export function DomainForm({ domains }: { domains: Domain[] }) {
  const [createState, createFormAction, createPending] = useActionState(
    createDomainAction,
    createInitialState,
  );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-heading font-medium">Dominios</h2>
      <p className="text-xs text-muted-foreground">
        Todo enlace corto y código QR resuelve a través de uno de estos.
      </p>

      <ul className="space-y-1 text-sm text-muted-foreground">
        {domains.length === 0 && (
          <li>Aún no hay dominios — agrega uno para crear enlaces cortos.</li>
        )}
        {domains.map((domain) => (
          <DomainRow key={domain.id} domain={domain} />
        ))}
      </ul>

      <form action={createFormAction} className="flex gap-2">
        <input
          name="hostname"
          required
          placeholder="go.example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={createPending}
          className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
        >
          {createPending ? <BinaryLoader /> : "Agregar"}
        </button>
      </form>

      {createState.error && (
        <p role="alert" className="text-sm text-destructive">
          {createState.error}
        </p>
      )}
    </div>
  );
}

function DomainRow({ domain }: { domain: Domain }) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateDomainAction,
    updateInitialState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteDomainAction,
    deleteInitialState,
  );

  // Close the edit row only once the save actually succeeds — not right after submit — so a
  // validation error (e.g. an empty hostname) stays visible with the field still open instead of
  // silently collapsing back to the read view with the error unreachable there. Detected as a
  // pending->not-pending transition with no error, during render (not an effect), same pattern as
  // ColorField's external-value sync elsewhere in this app.
  const [wasPending, setWasPending] = useState(false);
  if (wasPending && !updatePending && !updateState.error) {
    setEditing(false);
  }
  if (updatePending !== wasPending) {
    setWasPending(updatePending);
  }

  if (editing) {
    return (
      <li className="space-y-1">
        <form action={updateFormAction} className="flex gap-2">
          <input type="hidden" name="id" value={domain.id} />
          <input
            name="hostname"
            required
            defaultValue={domain.hostname}
            autoFocus
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
          <button
            type="submit"
            disabled={updatePending}
            className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground disabled:opacity-50"
          >
            {updatePending ? <BinaryLoader /> : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-input px-2 py-1 text-xs text-muted-foreground"
          >
            Cancelar
          </button>
        </form>
        {updateState.error && (
          <p role="alert" className="text-xs text-destructive">
            {updateState.error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span>
          {domain.hostname} ·{" "}
          {domain.verificationStatus === "verified" ? "verificado" : "pendiente"}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Editar ${domain.hostname}`}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <HoverMorphIcon idle={Pencil} active={Pencil} size={14} />
          </button>
          <form action={deleteFormAction}>
            <input type="hidden" name="id" value={domain.id} />
            <button
              type="submit"
              disabled={deletePending}
              aria-label={`Eliminar ${domain.hostname}`}
              className="rounded-md p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              {deletePending ? <BinaryLoader /> : <HoverMorphIcon idle={Trash2} active={Check} size={14} />}
            </button>
          </form>
        </span>
      </div>
      {deleteState.error && (
        <p role="alert" className="text-xs text-destructive">
          {deleteState.error}
        </p>
      )}
    </li>
  );
}
