"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EventRow, RegistrationFormConfig } from "@/modules/events";
import type { ManagedUser } from "@/modules/users";
import {
  updateEventAction,
  saveEventTelegramChatIdAction,
  saveEventTelegramMessageTemplateAction,
  publishEventAction,
  closeEventAction,
  type EventFormState,
} from "../../actions";
import { EventEmailContentFields } from "../../event-email-content-fields";
import { EventEditorTabPanel, EventEditorTabs } from "../../event-editor-tabs";
import { EventBasicFields } from "../../event-basic-fields";
import { EventLandingFields } from "../../event-landing-fields";
import { EventRegistrationFields } from "../../event-registration-fields";
import { resolveEventEmailContent } from "@/lib/events/event-email-content";
import { getOptionalDateTimeError } from "@/lib/events/event-date-time";
import { WebhookSettings } from "./webhook-settings";
import { EmbedSettings } from "./embed-settings";
import { ReceptionTeam } from "./reception-team";

const initialState: EventFormState = {};

export function EventEditForm({
  event,
  formConfig: initialFormConfig,
  embedUrl,
  embedSnippet,
  receptionUsers,
  assignedReceptionistIds,
}: {
  event: EventRow;
  formConfig: RegistrationFormConfig;
  embedUrl: string;
  embedSnippet: string;
  receptionUsers: ManagedUser[];
  assignedReceptionistIds: string[];
}) {
  const [state, formAction, pending] = useActionState(updateEventAction, initialState);
  const [telegramState, telegramAction, telegramPending] = useActionState(saveEventTelegramChatIdAction, initialState);
  const [telegramTemplateState, telegramTemplateAction, telegramTemplatePending] = useActionState(saveEventTelegramMessageTemplateAction, initialState);
  const [heroImageUrl, setHeroImageUrl] = useState<string | undefined>(event.heroImageUrl ?? undefined);
  const [checkInConfirmationRequired, setCheckInConfirmationRequired] = useState(event.checkInConfirmationRequired);

  return (
    <div className="flex flex-col gap-6">
      <EventEditorTabs
        tabs={[
          { id: "event", label: "Datos del evento" },
          { id: "landing", label: "Landing pública" },
          { id: "email", label: "Correos" },
          { id: "registration", label: "Formulario de registro" },
          { id: "integrations", label: "Integraciones" },
        ]}
        formTabIds={["event", "landing", "email", "registration"]}
        renderMainForm={(children) => (
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
            <input type="hidden" name="id" value={event.id} />
            {children}
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        {state.success ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{state.success}</p> : null}
          </form>
        )}
      >
        <EventEditorTabPanel id="event" active={false}>
          <EventBasicFields
            event={event}
            checkInConfirmationRequired={checkInConfirmationRequired}
            onCheckInConfirmationRequiredChange={setCheckInConfirmationRequired}
          />
        </EventEditorTabPanel>
        <EventEditorTabPanel id="landing" active={false}>
          <EventLandingFields
            organizationId={event.organizationId}
            agenda={event.agenda}
            sponsorLogos={event.sponsorLogos}
            heroImageUrl={heroImageUrl}
            onHeroImageUrlChange={setHeroImageUrl}
            description={event.description ?? ""}
          />
        </EventEditorTabPanel>
        <EventEditorTabPanel id="email" active={false}>
          <EventEmailContentFields initial={resolveEventEmailContent(event.emailContent)} />
        </EventEditorTabPanel>
        <EventEditorTabPanel id="registration" active={false}>
          <EventRegistrationFields initialFormConfig={initialFormConfig} />
        </EventEditorTabPanel>
        <EventEditorTabPanel id="integrations" active={false}>
          <div className="flex flex-col gap-3">
            <WebhookSettings
              eventId={event.id}
              webhookUrl={event.webhookUrl}
              webhookSecret={event.webhookSecret}
            />
            <form action={telegramAction} className="rounded-md border border-border p-4">
              <input type="hidden" name="id" value={event.id} />
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Grupo de Telegram
                <input
                  name="telegramChatId"
                  defaultValue={event.telegramChatId ?? ""}
                  placeholder="ID del grupo o @nombre"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal"
                />
                <span className="text-xs font-normal text-muted-foreground">
                  El bot enviará aquí las nuevas solicitudes y bloqueos de cupo.
                </span>
              </label>
              <Button type="submit" className="mt-3" disabled={telegramPending}>
                {telegramPending ? "Guardando…" : "Guardar grupo"}
              </Button>
              {telegramState.error ? <p role="alert" className="mt-2 text-sm text-destructive">{telegramState.error}</p> : null}
              {telegramState.success ? <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">{telegramState.success}</p> : null}
            </form>
            <form action={telegramTemplateAction} className="rounded-md border border-border p-4">
              <input type="hidden" name="id" value={event.id} />
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Mensaje de Telegram
                <textarea
                  name="template"
                  defaultValue={event.telegramMessageTemplate ?? ""}
                  maxLength={3000}
                  rows={7}
                  placeholder="Vacío = usa la plantilla global.\nEjemplo: {{nombre}} solicitó acceso a {{evento}}. Empresa: {{empresa}}"
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm font-normal"
                />
                <span className="text-xs font-normal text-muted-foreground">
                  Etiquetas: {"{{evento}} {{nombre}} {{email}} {{telefono}} {{empresa}} {{puesto}} {{ocupacion}} {{estado}} {{fecha_evento}} {{url_revision}}"}
                </span>
              </label>
              <Button type="submit" className="mt-3" disabled={telegramTemplatePending}>
                {telegramTemplatePending ? "Guardando…" : "Guardar mensaje"}
              </Button>
              {telegramTemplateState.error ? <p role="alert" className="mt-2 text-sm text-destructive">{telegramTemplateState.error}</p> : null}
              {telegramTemplateState.success ? <p role="status" aria-live="polite" className="mt-2 text-sm text-muted-foreground">{telegramTemplateState.success}</p> : null}
            </form>
            <EmbedSettings embedUrl={embedUrl} embedSnippet={embedSnippet} />
            <ReceptionTeam
              eventId={event.id}
              users={receptionUsers}
              assignedIds={assignedReceptionistIds}
            />
          </div>
        </EventEditorTabPanel>
      </EventEditorTabs>

      <div className="flex gap-3">
        {event.status !== "published" ? (
          <form action={publishEventAction}>
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="secondary">
              Publicar
            </Button>
          </form>
        ) : null}
        {event.status !== "closed" ? (
          <form
            action={closeEventAction}
            onSubmit={(e) => {
              // Keep close as an explicit action next to the save form.
              if (!confirm("¿Cerrar este evento? Dejará de aceptar nuevos registros.")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={event.id} />
            <Button type="submit" variant="outline">
              Cerrar
            </Button>
          </form>
        ) : null}
      </div>

    </div>
  );
}
