"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { resendInvitationAction, type ResendInvitationState } from "./actions";

const initialState: ResendInvitationState = {};

export function ResendInvitationButton({ eventId, attendeeId }: { eventId: string; attendeeId: string }) {
  const [state, action, pending] = useActionState(resendInvitationAction, initialState);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <form action={action}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="attendeeId" value={attendeeId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Mail className="size-3" aria-hidden="true" />
          <span>{pending ? "Enviando…" : "Reenviar invitación"}</span>
        </button>
      </form>
      {state.error ? <span role="alert" className="text-xs text-destructive">{state.error}</span> : null}
      {state.success ? <span role="status" className="text-xs text-muted-foreground">{state.success}</span> : null}
    </span>
  );
}
