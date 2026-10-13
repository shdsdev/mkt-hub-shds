"use client";

import { useActionState, useState } from "react";
import { addCompanionAction, type AddCompanionFormState } from "./actions";

const initialState: AddCompanionFormState = {};
const fieldClass = "rounded-md border border-input bg-transparent px-2 py-1 text-xs";

// Admin "master form" to add more companions to an already-submitted registration — a per-row
// inline form rather than a modal (craft-floor: a modal for a task that needs neither
// interruption nor protected focus is a lapse; this is a quick inline add next to the row it
// affects).
export function AddCompanionRow({
  registrationId,
  eventId,
  collectCompany,
  collectJobTitle,
}: {
  registrationId: string;
  eventId: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addCompanionAction, initialState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-primary underline">
        + Acompañante
      </button>
    );
  }

  if (state.success) {
    return <span className="text-xs text-muted-foreground">Acompañante agregado.</span>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="registrationId" value={registrationId} />
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-wrap gap-1.5">
        <input name="fullName" placeholder="Nombre" required className={fieldClass} />
        <input name="email" type="email" placeholder="Correo" required className={fieldClass} />
        {collectCompany ? <input name="company" placeholder="Empresa" className={fieldClass} /> : null}
        {collectJobTitle ? <input name="jobTitle" placeholder="Puesto" className={fieldClass} /> : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium"
        >
          {pending ? "Agregando…" : "Agregar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground">
          Cancelar
        </button>
      </div>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
