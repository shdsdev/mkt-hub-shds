"use client";

import { useActionState, useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { UserRoundPlus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanionAddedDialog } from "../../companion-added-dialog";
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
  const [successOpen, setSuccessOpen] = useState(false);
  const [occupation, setOccupation] = useState("");
  const [state, formAction, pending] = useActionState(addCompanionAction, initialState);

  useEffect(() => {
    if (!state.addedCompanion) return;
    setOpen(false);
    setSuccessOpen(true);
  }, [state.addedCompanion]);

  return (
    <>
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
                <input type="hidden" name="occupation" value={occupation} required />
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Actividad profesional
                  </label>
                  <Select value={occupation} onValueChange={(value) => setOccupation(value ?? "")}>
                    <SelectTrigger className="h-11 w-full rounded-lg border-border/80 bg-background/80 shadow-sm transition-colors hover:border-primary/50 data-placeholder:text-muted-foreground">
                      <SelectValue placeholder="Selecciona una actividad" />
                    </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wholesaler">Mayorista</SelectItem>
                    <SelectItem value="manufacturer">Fabricante</SelectItem>
                    <SelectItem value="architect-decorator">Arquitecto / Decorador</SelectItem>
                    <SelectItem value="installer-technician">Instalador o técnico</SelectItem>
                  </SelectContent>
                  </Select>
                </div>
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
      <CompanionAddedDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        companion={state.addedCompanion ?? null}
      />
    </>
  );
}
