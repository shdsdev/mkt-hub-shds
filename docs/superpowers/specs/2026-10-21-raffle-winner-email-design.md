# Branded Raffle Winner Email and Redemption Data

Upgrade the raffle winner email from a plain text-like message to a branded, operational receipt. The email will give the winner enough information to identify themselves, understand the prize, and complete an exchange through the existing HCS validation flow without changing HCS code or contracts.

## Quick path

1. Confirm a draw and send a branded email containing the winner, event, prize, deadline, instructions, and both validation identifiers.
2. Label the identifiers by purpose so the winner does not confuse registration validation with prize redemption.
3. Keep HCS integration unchanged: Marketing Hub supplies the existing codes and HCS continues to validate and claim through its current endpoints.

## Data Contract

| Email section | Source | Purpose |
|---|---|---|
| Winner name | `raffle_draws.attendeeName` | Personal greeting and identity confirmation |
| Winner email | `raffle_draws.attendeeEmail` | Recipient and visible confirmation |
| Event | Joined `events.name` | Context for the prize |
| Prize | Joined `raffle_prizes.name` | Prize won |
| Instructions | `raffle_prizes.instructions` | Organizer-provided redemption guidance |
| Deadline | `raffle_prizes.claimDeadlineAt` | Time limit, when configured |
| Registration code | `event_attendees.backupCode` | Identifies the attendee in HCS validation |
| Redemption code | `raffle_draws.attendeeCode` | Identifies this prize unit for exchange/claim |
| Initial status | Draw status | Communicates that the prize is pending redemption |

The two codes must remain visually and semantically separate. The registration code is the attendee identity key; the redemption code is the single-prize exchange key. Neither code is replaced by the other.

## HCS Boundary

Marketing Hub owns only the data sent in the winner email and the existing raffle service data used to generate it. HCS remains responsible for its own client experience and integration implementation.

The current contract remains unchanged:

1. HCS validates the attendee using the registration/backup code.
2. HCS returns the associated winner and prize data.
3. HCS claims the prize using the draw redemption code.
4. A claimed draw is rejected on subsequent claim attempts and retains its delivery audit state.

No HCS route, request schema, response schema, authentication behavior, or HCS-side UI is changed by this work.

## Email Layout

The template will use table-based HTML and inline styles for Gmail and Outlook compatibility:

- `Shades Spaces` header with event context.
- High-contrast winner message: “¡Felicidades, [nombre]!”
- Prize highlight card with the exact prize name.
- Winner details block with name and recipient email.
- Separate registration-code block with instructions to present/use it for attendee validation.
- Separate redemption-code block with stronger visual emphasis and instructions to present it when exchanging the prize.
- Claim instructions, deadline, and initial status.
- Official sponsor footer: `Shades de México`.
- Accessible text labels, sufficient contrast, responsive width, and escaped dynamic values.

The subject remains actionable and specific: `Ganaste: [premio]`.

## Delivery and Retry Behavior

The existing notification log and resend behavior remain the source of truth. The branded template is used for both first delivery and resend, with no duplicate notification record for the same draw.

If a required redemption identifier cannot be loaded, the send must fail rather than send an incomplete redemption email. The failure is logged through the existing notification path.

## Verification

- Unit tests cover both codes being passed to the email renderer and dynamic HTML escaping.
- Unit tests cover the existing HCS data lookup boundary without changing HCS route contracts.
- Tests cover first send and resend using the same branded template.
- TypeScript, lint, focused raffle/notification tests, and production build must pass.
- Rendered HTML must be inspected at desktop and narrow email widths.

## Out of Scope

- Changes to HCS application code.
- Changes to HCS API routes, authentication, or claim semantics.
- New customer accounts or public redemption pages in Marketing Hub.
- Replacing the existing Resend provider or notification-log model.

## Next Step

Implement the data lookup and branded template in Marketing Hub, then verify the rendered email and existing HCS contract behavior.
