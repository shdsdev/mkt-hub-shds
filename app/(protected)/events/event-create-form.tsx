"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { createEventAction, type EventFormState } from "./actions";
import { EventEmailContentFields } from "./event-email-content-fields";
import { EventEditorTabPanel, EventEditorTabs } from "./event-editor-tabs";
import { EventBasicFields } from "./event-basic-fields";
import { EventLandingFields } from "./event-landing-fields";
import { EventRegistrationFields } from "./event-registration-fields";
import { getDefaultEventEmailContent } from "@/lib/events/event-email-content";
import { getOptionalDateTimeError } from "@/lib/events/event-date-time";
import type { RegistrationFormConfig } from "@/modules/events";

const initialState: EventFormState = {};

export function EventCreateForm({
  organizationId,
  initialFormConfig,
}: {
  organizationId: string;
  initialFormConfig: RegistrationFormConfig;
}) {
  const [state, formAction, pending] = useActionState(createEventAction, initialState);
  const [heroImageUrl, setHeroImageUrl] = useState<string>();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="font-heading font-medium">Crear evento</h2>
        <p className="text-xs text-muted-foreground">
          El evento se crea en estado borrador y no es visible públicamente hasta publicarlo.
        </p>
      </div>
      <form
        action={formAction}
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          if (getOptionalDateTimeError(String(formData.get("endDate") ?? ""), String(formData.get("endTime") ?? ""))) {
            event.preventDefault();
          }
        }}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      >
        <EventEditorTabs
          tabs={[
            { id: "event", label: "Datos del evento" },
            { id: "landing", label: "Landing pública" },
            { id: "email", label: "Correos" },
            { id: "registration", label: "Formulario de registro" },
            { id: "integrations", label: "Integraciones" },
          ]}
        >
          <EventEditorTabPanel id="event" active={false}>
            <EventBasicFields />
          </EventEditorTabPanel>
          <EventEditorTabPanel id="landing" active={false}>
            <EventLandingFields
              organizationId={organizationId}
              agenda={[]}
              sponsorLogos={[]}
              heroImageUrl={heroImageUrl}
              onHeroImageUrlChange={setHeroImageUrl}
            />
          </EventEditorTabPanel>
          <EventEditorTabPanel id="email" active={false}>
            <EventEmailContentFields initial={getDefaultEventEmailContent()} />
          </EventEditorTabPanel>
          <EventEditorTabPanel id="registration" active={false}>
            <EventRegistrationFields
              initialFormConfig={initialFormConfig}
            />
          </EventEditorTabPanel>
          <EventEditorTabPanel id="integrations" active={false}>
            <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              Las integraciones se habilitan después de crear el evento.
            </div>
          </EventEditorTabPanel>
        </EventEditorTabs>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear evento"}
          </Button>
        </div>
        {state.error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}
        {state.success ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground sm:col-span-2">{state.success}</p>
        ) : null}
      </form>
    </section>
  );
}
