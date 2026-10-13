"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  setWebhookAction,
  regenerateWebhookSecretAction,
  type WebhookFormState,
} from "../../actions";

const initialState: WebhookFormState = {};

// Admin feedback round ("poder generar un webhook por evento") — the admin supplies their own
// destination URL; we generate and display the signing secret they configure on their receiving
// end to verify the `x-webhook-secret` header.
export function WebhookSettings({
  eventId,
  webhookUrl,
  webhookSecret,
}: {
  eventId: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
}) {
  const [urlState, urlAction, urlPending] = useActionState(setWebhookAction, initialState);
  const [secretState, secretAction, secretPending] = useActionState(
    regenerateWebhookSecretAction,
    initialState,
  );
  const currentSecret = secretState.webhookSecret ?? urlState.webhookSecret ?? webhookSecret;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-heading font-medium">Webhook</h2>
        <p className="text-xs text-muted-foreground">
          Notificamos tu URL (POST con JSON) cuando alguien se registra o hace check-in.
        </p>
      </div>

      <form action={urlAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={eventId} />
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium">
          URL de destino
          <Input name="webhookUrl" type="url" defaultValue={webhookUrl ?? ""} placeholder="https://tu-sistema.com/webhook" />
        </label>
        <Button type="submit" variant="secondary" disabled={urlPending}>
          {urlPending ? "Guardando…" : "Guardar URL"}
        </Button>
      </form>

      {currentSecret ? (
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Secreto (header <code className="text-xs">x-webhook-secret</code>)
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={currentSecret} className="min-w-64 flex-1 font-mono text-xs" />
            <form action={secretAction}>
              <input type="hidden" name="id" value={eventId} />
              <Button type="submit" variant="outline" size="sm" disabled={secretPending}>
                {secretPending ? "…" : "Regenerar"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {urlState.error ? <p className="text-sm text-destructive">{urlState.error}</p> : null}
      {urlState.success ? <p className="text-sm text-muted-foreground">{urlState.success}</p> : null}
      {secretState.error ? <p className="text-sm text-destructive">{secretState.error}</p> : null}
      {secretState.success ? (
        <p className="text-sm text-muted-foreground">{secretState.success}</p>
      ) : null}
    </section>
  );
}
