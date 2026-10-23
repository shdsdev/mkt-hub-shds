# Event Benefit Redemption Design

## Goal

Add a second operational validator to the existing event check-in page. Staff can scan or enter the same QR/pass code, require a confirmed check-in, choose one event-configured gift or discount, and record the redemption without changing any previously issued QR codes.

## Product Rules

- Every event chooses one redemption scope:
  - **Per attendee:** each checked-in attendee can redeem once.
  - **Per registration:** the first checked-in attendee belonging to a registration redeems for the whole group; other attendees cannot redeem again.
- The redemption scope is locked after the first redemption, including after a redemption is annulled.
- An attendee must have a confirmed check-in before redemption.
- Each attendee or registration can have only one active redemption.
- The seller chooses the benefit at redemption time from the event's active catalog.
- A benefit is either:
  - **Discount:** a percentage value.
  - **Gift:** a required display name.
- Each benefit has either unlimited availability or a maximum quantity.
- A successful redemption consumes one available unit. An annulled redemption releases that unit.
- Re-scanning does not create another check-in or redemption.
- An annulled redemption is the only state that permits a new benefit to be assigned.

## Roles

- `ADMIN` and `EVENT_EDITOR` can create, edit, activate/deactivate, and delete catalog benefits when safe, and can annul redemptions.
- `ADMIN` and `EVENT_EDITOR` can configure the event redemption scope.
- `ADMIN`, `EVENT_EDITOR`, and assigned `RECEPTION` can operate both validation panels.
- Redemption actions must use dedicated capability checks. They must not broaden the current event update action, which is restricted to administrators.
- Audit records must identify the actor, event, attendee or registration, benefit, operation, and reason for an annulment.

## Data Model

### Event configuration

Add nullable event-level redemption settings:

- `benefitRedemptionScope`: `attendee` or `registration`.
- `benefitRedemptionStartedAt`: timestamp set atomically with the first redemption and used to lock scope changes.

An unset scope means the feature is not configured for that event. Scope changes are rejected once `benefitRedemptionStartedAt` is set.

### Benefits

Create an `event_benefits` table scoped to an event:

- identity and event foreign key
- `kind`: `discount` or `gift`
- `name`: required for gifts; optional for discounts
- `percentage`: required for discounts and constrained to a valid percentage range; null for gifts
- `quantity`: nullable for unlimited; non-negative for capped stock
- `active`
- timestamps

The service validates the kind-specific fields and prevents deleting a benefit with redemption history. Deactivation is preferred when a benefit should no longer be offered.

### Redemptions

Create an `event_benefit_redemptions` table:

- identity and event foreign key
- benefit foreign key
- attendee foreign key for the scanned attendee
- registration foreign key for the effective redemption subject
- actor foreign key
- `status`: `active` or `annulled`
- creation and annulment timestamps
- annulment actor and reason

The effective subject is the attendee in attendee scope and the registration in registration scope. Store both references on the redemption row and enforce uniqueness with two partial indexes: one on `(event_id, attendee_id)` for active attendee-scope rows, and one on `(event_id, registration_id)` for active registration-scope rows. The design must preserve the selected benefit and actor on history even after an annulment.

## Transactional Service Operations

Implement focused service functions rather than putting business rules in server actions:

- list and validate event benefits
- create/update/deactivate benefits
- look up a code for redemption and return attendee, registration, check-in state, current redemption, and available benefits
- redeem a benefit atomically
- annul a redemption atomically

The redemption transaction must:

1. Lock or atomically update the selected benefit stock when capped.
2. Re-read the attendee and registration to verify event ownership and confirmed check-in.
3. Resolve the effective subject from the event scope.
4. Reject an existing active redemption for that subject.
5. Insert the redemption and set `benefitRedemptionStartedAt` when this is the first redemption.
6. Roll back all changes on any validation or constraint failure.

The service must not mutate check-in timestamps while redeeming.

## Operational UI

Keep the existing Check-in route and place two operational cards in the same content area:

### Validar acceso

Retain the current scan/manual-code workflow and result dialog. A repeated scan remains a no-op and displays `Acceso ya validado`.

### Validar beneficio

- Use the same QR/pass and backup-code lookup semantics.
- Show a clear precondition when the attendee is not checked in: `Primero debe realizar el check-in.`
- For an eligible attendee, show identity, check-in confirmation, active benefits, and remaining stock.
- Require an explicit benefit selection and confirmation.
- On success show the benefit, timestamp, and responsible user.
- On repeat show `Beneficio ya canjeado`, including the assigned benefit and date.
- For registration scope, show that the group has already redeemed when another attendee from the same registration is scanned.
- Keep camera capture isolated so only one of the two panels can be active at a time. Manual entry remains available independently.
- Use stacked cards on mobile, with access first and benefit redemption second. Preserve visible focus, disabled/loading states, readable status text, and touch targets.

## Configuration UI

Add a `Beneficios` tab to the event editor for `ADMIN` and `EVENT_EDITOR`:

- choose attendee or registration scope
- add discount percentage or gift name
- choose unlimited or capped quantity
- activate/deactivate benefits
- display current remaining stock
- display redemption history
- provide annul action with a required reason
- disable scope controls after the first redemption and explain why

Configuration changes use dedicated server actions and event access checks. The existing event form action should remain unchanged unless a narrowly scoped shared validation is required.

## Error and Status Contract

Return explicit, non-destructive results for:

- invalid or unknown QR/code
- missing check-in
- already checked-in access
- already redeemed attendee or registration
- inactive benefit
- exhausted benefit stock
- locked scope configuration
- unauthorized operation
- invalid annulment reason

The UI must communicate state with text and accessible status semantics, not color alone.

## Testing Strategy

### Domain and database

- benefit kind validation
- percentage and quantity boundaries
- attendee and registration subject resolution
- check-in precondition
- one active redemption per subject
- first redemption locks scope
- capped stock cannot be over-consumed under concurrent requests
- annulment releases stock and permits one replacement redemption
- history remains intact after annulment

### Server actions and access

- assigned reception can look up and redeem
- unassigned reception cannot operate the event
- editor and admin can configure and annul
- unrelated roles cannot use redemption actions
- audit records include redemption and annulment details

### UI

- both cards render on desktop and stack on mobile
- only one scanner is active at a time
- manual code entry works for both panels
- all specified status messages render
- loading, disabled, error, focus, and retry states are accessible

## Out Of Scope

- changing existing QR/pass payloads or reissuing passes
- automatic benefit assignment before the seller scans
- multiple benefits for one effective subject
- payment processing or discount redemption at an external point-of-sale system
- changing invitation expiration behavior
