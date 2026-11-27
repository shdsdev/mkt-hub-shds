# Event Registration Approval Mode

## Goal

Allow each event to choose whether registrations require manual review or are approved automatically.

## User-facing behavior

The event editor exposes an **Approval of registrations** setting with two modes:

- **Manual:** new registrations remain pending review. Staff can approve, waitlist, or reject them.
- **Automatic:** new registrations are confirmed immediately without staff review.

Changing an event from manual to automatic also processes existing pending registrations:

- Registrations are approved while capacity is available.
- Confirmation emails are sent when the event's email field is enabled.
- Registrations that cannot be approved because capacity is exhausted remain pending.
- The operation reports the number approved and the number still pending.

Changing from automatic back to manual affects only future registrations. Existing confirmed registrations are not reverted.

If the event does not collect email addresses, no confirmation email is sent. Internal notifications and status updates still occur.

## Data model

Extend `RegistrationFormConfig` with an approval mode:

```ts
approvalMode: "manual" | "automatic"
```

The default remains `"manual"` for backward compatibility with existing events and stored configurations.

The existing schema resolver supplies the default when older event configurations do not contain the field.

## Registration flow

When a public registration is created:

- In manual mode, preserve the current pending-review behavior.
- In automatic mode, confirm the registration in the same transaction, applying the existing capacity rules.
- If automatic confirmation is blocked by capacity, preserve the registration as pending and expose the existing capacity outcome.

Automatic approval must not send email inside the database transaction. Email delivery remains after the registration commit and follows the existing email-enabled check.

## Enabling automatic mode

Saving the event with automatic mode enabled triggers a server-side transition for that event:

1. Persist the configuration.
2. Lock the event for capacity decisions.
3. Find pending registrations.
4. Confirm them in deterministic creation order until capacity is reached.
5. Send confirmation emails after successful commits when email collection is enabled.
6. Revalidate the registrations and event editor paths.
7. Return a summary indicating how many registrations were approved and how many remain pending.

The transition is idempotent: already confirmed, rejected, waitlisted, or cancelled registrations are not changed.

## Admin interface

The registrations detail view keeps the current actions for manual-review registrations. Automatic events should not present manual review actions for registrations that are already confirmed.

The editor copy should explain that enabling automatic mode also processes pending registrations and may send confirmation emails.

## Error handling

- Invalid or missing approval mode values fall back to `"manual"`.
- Capacity failures do not fail the configuration save; they leave affected registrations pending and are included in the transition summary.
- Email delivery failures are recorded using the existing audit/error path and do not roll back a confirmed registration.
- Permission checks remain the same as the existing event editor and review actions.

## Testing

Cover:

- Schema compatibility for configurations without `approvalMode`.
- Manual mode preserving pending registrations.
- Automatic mode confirming new registrations.
- Automatic mode respecting capacity.
- Switching to automatic approving pending registrations.
- Pending registrations beyond capacity remaining pending.
- Confirmation emails sent only when email collection is enabled.
- Switching back to manual not reverting confirmed registrations.
- Editor rendering and saving both modes.
- Registration actions visibility for manual and automatic events.
