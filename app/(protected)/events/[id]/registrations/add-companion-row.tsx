"use client";

import { useActionState, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { UserRoundPlus, X } from "lucide-react";
import { addCompanionAction, type AddCompanionFormState } from "./actions";

const initialState: AddCompanionFormState = {};
const fieldClass = "h-10 rounded-md border border-input bg-transparent px-3 text-sm";

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

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        aria-label="Agregar acompañante"
        title="Agregar acompañante"
      >
        <UserRoundPlus className="size-4" />
      </button>
      {open ? (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60" />
          <DialogPrimitive.Popup className="fixed inset-0 z-50 m-auto h-fit max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-2xl">
              <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Cerrar">
                <X className="size-4" />
              </button>
              <DialogPrimitive.Title className="text-base font-semibold">Agregar acompañante</DialogPrimitive.Title>
              <p className="mt-1 text-sm text-muted-foreground">Completa los datos del nuevo asistente.</p>
              <form action={formAction} className="mt-5 flex flex-col gap-3">
                <input type="hidden" name="registrationId" value={registrationId} />
                <input type="hidden" name="eventId" value={eventId} />
                <input name="fullName" placeholder="Nombre completo" required className={fieldClass} />
                <input name="email" type="email" placeholder="Correo" required className={fieldClass} />
                {collectCompany ? <input name="company" placeholder="Empresa" className={fieldClass} /> : null}
                {collectJobTitle ? <input name="jobTitle" placeholder="Puesto" className={fieldClass} /> : null}
                <select name="occupation" required defaultValue="" className={fieldClass}>
                  <option value="" disabled>Actividad profesional</option>
                  <option value="distributor">Distribuidor/a</option>
                  <option value="manufacturer">Fabricante</option>
                  <option value="architect">Arquitecto/a</option>
                  <option value="decorator">Decorador/a</option>
                  <option value="installer-technician">Instalador/a o técnico/a</option>
                </select>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2 text-sm">Cancelar</button>
                  <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{pending ? "Agregando…" : "Agregar"}</button>
                </div>
                {state.error ? <span className="text-sm text-destructive">{state.error}</span> : null}
                {state.success ? <span className="text-sm text-muted-foreground">Acompañante agregado.</span> : null}
              </form>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}
