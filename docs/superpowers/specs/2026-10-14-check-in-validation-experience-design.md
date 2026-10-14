# Check-in Validation Experience Design

**Date:** 2026-10-14

## Goal

Redesign the Check-in operator experience so QR and manual validation share one fast, visual result flow that remains visible until the host dismisses it.

## Design Read

This is an internal event-operations tool for hosts at an entrance, using the existing dark Marketing Hub language with a high-contrast access-terminal feel. The attendee identity card is the visual centerpiece; status feedback remains explicit and separate from client-category color.

## Decisions

- The initial Check-in surface shows exactly two primary actions: `Escanear QR` and `Ingresar código`.
- The camera does not open until the host selects `Escanear QR`.
- Manual entry opens a focused code-capture modal with the existing folio/code validation contract.
- QR and manual validation feed the same result presentation.
- The result remains open until the host explicitly closes it or chooses the next available action.
- The result uses one consistent shell for eligible, already checked-in, blocked, and not-found states.
- The client-category color belongs to the attendee card and is derived from the existing `occupation` value; no migration or stored color is needed.
- Status uses a separate semantic indicator so category color and access state are never conflated.
- The authenticated internal UI uses the existing dark platform styles, components, typography, tokens, focus treatment, and responsive conventions.
- Public pages, emails, and external attendee surfaces are not changed by this design.

## Entry Surface

The idle state is intentionally sparse and operational:

- A short instruction explains that the host can scan or enter a code.
- `Escanear QR` and `Ingresar código` are always visible.
- Desktop places the actions side-by-side; mobile stacks them with touch-safe sizing.
- No camera element is rendered in the idle state.
- Any previous result is dismissed before starting a new validation.

## QR Flow

1. Host selects `Escanear QR`.
2. A responsive camera surface opens in a full-height modal/stage.
3. The camera view includes a scan frame, concise instruction, active/loading feedback, and `Cancelar`.
4. On detection, the scanner stops and submits the code through the existing server action.
5. The camera surface closes and the shared result modal opens.
6. The result remains visible until the host closes it.

## Manual Flow

1. Host selects `Ingresar código`.
2. A focused code-entry modal opens using the existing segmented folio input behavior.
3. The modal provides a clear `Validar código` action and a way back to the entry surface.
4. Validation uses the same server action and result state as QR.
5. The capture modal closes and the shared result modal opens.

## Shared Result Modal

### Responsive Composition

- Mobile and tablet use a near-full-screen modal with safe-area-aware padding.
- Desktop uses a large centered modal over a darkened backdrop.
- The content must remain scannable without requiring horizontal scrolling.
- The host must be able to close the result with an explicit action.

### Attendee Card

For a known attendee, the card includes:

- Full name as the strongest identity element.
- Visible category pill and category-tinted card surface derived from `occupation`.
- Phone number.
- Company.
- Email.
- Backup/access code only where operationally useful.
- Status result with icon and text.

Category mapping:

```text
distributor            -> orange
manufacturer           -> blue
architect               -> green
decorator               -> yellow
installer-technician    -> red
```

The category color is not the only carrier of meaning; the category label remains visible in text.

### Status Semantics

- `eligible`: green status treatment, large check icon, `Acceso correcto` or `Verificado`, and first-access context when applicable.
- `already_checked_in`: amber status treatment, informative icon, and `Ya registró entrada`.
- `blocked` with cancellation: red status treatment and `Registro cancelado`.
- `blocked` with waitlist: red status treatment and `Lista de espera`.
- `not_found`: same modal shell, red status treatment, no attendee card because no attendee data exists, and `No encontrado`.

The category accent and status accent are separate visual layers. An orange Distributor card can have a green `Acceso correcto` status.

## Interaction State Machine

```text
idle
  -> scanner_open
  -> manual_open

scanner_open
  -> validating
  -> idle (cancel/error)

manual_open
  -> validating
  -> idle (cancel/invalid input)

validating
  -> result_open
  -> error_visible

result_open
  -> idle (host closes)
```

The existing confirmation policy remains intact: if confirmation is required, the result modal exposes the confirmation action; if it is automatic, the check-in is confirmed without removing the result visibility before the host dismisses it.

## Error, Loading, And Accessibility Requirements

- Show a visible loading state while lookup or confirmation is pending.
- Keep the modal open when confirmation fails so the host sees the error and can retry.
- Place errors near the action that caused them and expose them with `role="alert"` or an equivalent live region.
- Keep keyboard focus inside open dialogs and return focus to the triggering action on close.
- All status indicators include text and an icon; color is never the only signal.
- Interactive controls meet touch-safe sizing on mobile.
- Respect `prefers-reduced-motion`; transitions are short and communicate state changes only.

## Architecture Boundaries

- `CheckInForm` owns the entry-mode state and coordinates QR/manual/result transitions.
- `QrScanner` keeps its current detection and error contract.
- `ManualFolioDialog` keeps its current input and submit contract unless its visual shell needs to be aligned.
- `CheckInResultDialog` owns the shared result shell, category card, status presentation, and explicit close/confirm actions.
- `lookupCheckInAction` and `confirmCheckInAction` remain the server boundaries; no database or migration is required for category colors.
- Category color is a presentation mapping from `occupation`, not persisted attendee data.

## Non-Goals

- No migration or new database field.
- No changes to QR/token validation rules.
- No change to permissions, confirmation policy, check-in audit, or server action payloads.
- No public-facing attendee card redesign.
- No automatic access authorization based on client category.

## Verification Requirements

- QR detection opens the shared result modal.
- Manual code validation opens the same shared result modal.
- The result stays visible until the host closes it.
- All four known-result states preserve their existing semantics.
- Known attendees show name, phone, company, email, category label, and category color.
- Category and status colors remain visually distinct.
- Mobile, tablet, and desktop layouts remain usable without horizontal overflow.
- Keyboard focus, loading, confirmation, retry, and error states remain operable.
- Existing Check-in tests, lint, typecheck, and production build pass.
