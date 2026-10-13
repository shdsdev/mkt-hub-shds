"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cancelRegistrationAction, type CancelFormState } from "./actions";

const initialState: CancelFormState = {};

export function ConfirmCancelForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(cancelRegistrationAction, initialState);

  if (state.success) {
    return (
      <p className="text-sm text-muted-foreground">Tu registro fue cancelado. Gracias por avisarnos.</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Cancelando…" : "Cancelar mi registro"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
