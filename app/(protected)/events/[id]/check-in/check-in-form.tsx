"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkInAction, type CheckInFormState } from "./actions";

const initialState: CheckInFormState = {};

export function CheckInForm({ eventId }: { eventId: string }) {
  const [state, formAction, pending] = useActionState(checkInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Código
        <Input name="code" autoFocus required placeholder="Pase QR o código de respaldo" />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Verificando…" : "Registrar entrada"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-muted-foreground">
          {state.alreadyCheckedIn
            ? `${state.attendeeName} ya había hecho check-in.`
            : `Check-in registrado para ${state.attendeeName}.`}
        </p>
      ) : null}
    </form>
  );
}
