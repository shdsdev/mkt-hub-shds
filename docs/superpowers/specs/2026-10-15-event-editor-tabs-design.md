# Event Editor Tabs

## Goal

Reorganize the event editor into clear internal tabs so administrators can find event data, public landing content, email communication, registration settings, and integrations without navigating one long mixed form.

## User-facing structure

The editor will expose five tabs:

1. **Datos del evento**: event name, event date, start time, end time, location, capacity, reminder, and check-in confirmation.
2. **Landing pública**: description, cover image, agenda, and sponsor logos.
3. **Correos**: confirmation introduction, 48-hour reminder introduction, logistics, and benefit/promotion copy.
4. **Formulario de registro**: visible/required fields, companion support, brands, interests, consent links, and marketing consent.
5. **Integraciones**: webhook, embeddable form, and reception team.

## Interaction design

- Use an accessible tablist with one active panel at a time and a clear active-state indicator.
- Keep the existing admin visual language, checkbox behavior, premium controls, and responsive layout.
- Keep all fields for the main event save mounted in the DOM while hidden panels are inactive. This preserves the existing single server action and ensures every field remains in `FormData`.
- Keep integration actions outside the main event form because webhook and reception controls submit independent server actions. They can live inside the Integraciones panel without creating nested forms.
- Preserve the existing bottom action area for save, publish, and close actions.

## Date and time model

- Keep the persisted model as `startsAt` and nullable `endsAt` timestamps.
- Replace the ambiguous `Inicio` and `Fin` controls with separate fields:
  - `Fecha del evento`
  - `Hora de inicio`
  - `Fecha de finalización` (optional)
  - `Hora de finalización` (optional)
- The form will combine the local date/time values into the existing `startsAt` and `endsAt` payloads before submission, preserving the current server schema and database contract.
- Add helper text clarifying that the end time is optional and should be used when the event has a defined closing time.
- Keep `Ubicación` as a dedicated, explicitly labeled event field and retain its current optional behavior.

## Component boundaries

- Add a small client-side tabs component for tab state, keyboard navigation, `aria-selected`, and panel visibility.
- Keep the current event editor fields and server action unchanged wherever possible; move them into the appropriate panel instead of duplicating state or persistence.
- Extract the main event form's save button/status area only if needed to keep the form boundary valid.
- Render `WebhookSettings`, `EmbedSettings`, and `ReceptionTeam` in the Integraciones panel without changing their server actions.

## Validation and testing

- Preserve the existing event action schemas and persisted timestamp contract.
- Add focused tests for date/time combination and optional end-date handling.
- Verify that changing tabs does not lose entered values and that saving from any tab submits all main-form fields.
- Run lint, typecheck, the full test suite, and production build.
- Run the Impeccable detector against changed UI files after implementation.

## Out of scope

- No database migration.
- No changes to public event pages or email rendering.
- No redesign of the existing admin visual system.
- No new event fields beyond the requested date/time clarification and tab organization.
