# Event Location Card Design

## Goal

Prevent the event location from obscuring important content in the invitation image on the public event landing.

## Design

- Remove the location card from the hero image overlay.
- Render the location as an independent card immediately below the hero image.
- Keep the card before the registration form so visitors see the location before registering.
- Preserve the current visual identity: white surface, rounded corners, readable text, and subtle shadow.
- Keep the card conditional: if the event has no location, render nothing.
- Do not change the invitation image sizing, registration flow, agenda, or description overlay behavior.

## Responsive behavior

- The location card spans the available landing width with the same horizontal constraints as the hero.
- Long addresses wrap naturally without horizontal overflow.
- The card remains readable on narrow mobile screens and desktop.

## Verification

- Add a landing regression test confirming the location is not rendered inside the hero image container.
- Confirm the location remains rendered before the registration section.
- Run the focused landing test, typecheck, and lint.
