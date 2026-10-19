# Event Form Builder Design

## Goal

Evolve the event registration form from a fixed configuration into a versioned,
visual event-specific form builder while preserving the existing public form,
embed, registration lifecycle, and attendee model.

## Scope

This change applies only to forms attached to events. It does not create the
future standalone forms module.

Custom fields initially apply to the primary attendee only. Companion fields
remain on the existing fixed flow and can be extended later.

## Approved Field Types

- Short text
- Long text
- Number
- Email
- Phone
- Date
- Checkbox
- Single select
- Multiple select

Custom checkbox fields may optionally contain a configurable hyperlink. Privacy,
terms, and marketing consent remain explicit legal fields.

## Architecture

The event owns a versioned registration form schema. The existing fixed fields
remain first-class fields and keep their current database columns. Custom field
definitions are stored in the event form configuration with stable IDs and an
ordered position.

Each submission stores custom answers associated with the primary registration.
The answer payload is keyed by field ID and includes the form version plus the
field metadata needed to render historical responses after a field is edited or
removed.

The client may preview and edit fields, but the server is authoritative for
schema validation, required fields, allowed options, field IDs, event access,
and organization access.

## Form Builder UX

The existing `Formulario de registro` event-editor tab becomes a visual builder:

1. A protected list shows fixed fields and custom fields in order.
2. Custom fields can be added, edited, duplicated, enabled, disabled, deleted,
   and reordered.
3. A field editor configures label, help text, required state, options,
   number constraints, and optional checkbox link.
4. A preview renders the same controls used by the public form and embed.

The builder uses the existing premium Base UI select primitive rather than
native selects. The existing animated checkbox treatment remains in place but
is extended to support rich labels containing links and required markers.

## Public Form and Embed

The landing form and embed consume the same resolved event form schema and the
same field renderer. Form values use stable field IDs. Public submission is
accepted only for published events and is validated against the active schema
on the server.

Existing event behavior remains unchanged:

- Capacity still determines `confirmed` versus `waitlisted`.
- Existing consent, UTM, companion, webhook, and confirmation-email behavior is
  preserved.
- Closed events do not accept submissions.

## Registration States

Operational registration status remains independent:

- `confirmed`
- `waitlisted`
- `cancelled`
- `checked_in`

An administrative review status is added separately:

- `new`
- `in_review`
- `approved`
- `rejected`

Review changes record the reviewing user and timestamp and are available in the
registration table, detail view, filters, and CSV/Excel exports.

## Response Presentation

Custom answers are available in:

- Registration detail.
- Registration table, with a compact column representation.
- CSV/Excel export, with one stable column per known field.

Historical responses remain readable after schema changes by retaining the
submitted field metadata in the response snapshot.

## Validation and Failure Handling

- Field IDs must be unique and stable within an event.
- Labels must be non-empty and length-limited.
- Required fields must be enabled.
- Select answers must belong to the configured options.
- Multiple-select answers must be arrays with no duplicate values.
- Number, date, email, phone, and text values use type-specific validation.
- Invalid form configuration cannot replace the last valid configuration.
- Unknown or tampered public field values are rejected server-side.
- A failed save leaves the local builder state intact.

## Testing

The implementation must cover:

- Configuration schema defaults, versioning, migration, and invalid data.
- Field rendering for every supported type.
- Public and embed submission validation.
- Historical response snapshots.
- Review status transitions and permissions.
- Table, detail, and CSV/Excel response presentation.
- Keyboard focus, dropdown interaction, checkbox links, errors, disabled state,
  and responsive layouts.

## Non-Goals

- Standalone forms unrelated to events.
- Conditional logic between fields.
- File uploads.
- Email notification rules per custom field.
- Advanced analytics for custom answers.
- Custom fields for companions in the first release.
