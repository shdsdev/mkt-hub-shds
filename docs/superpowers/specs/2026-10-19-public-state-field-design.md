# Public State Field Design

## Goal

Add an optional, configurable `Estado` field to the public event registration form for the 32 Mexican states, while keeping internal registration forms unchanged.

## Scope

- Add `state` as a nullable attendee-level database column.
- Expose `state` in the public registration configuration with `Mostrar` and `Obligatorio` controls.
- Render a single-select dropdown in the public form.
- Validate the field only when enabled and required.
- Show the primary attendee's state in registration tables and CSV exports.
- Keep internal admin registration flows unchanged; they persist `NULL`.
- Preserve checkbox behavior and accessibility while removing unnecessary decorative containers.

## Architecture

`state` is a first-class property of `event_attendees`, not a custom JSON answer, because it is a fixed catalog field that must be queryable and exportable. The public action resolves the event's form configuration, validates the submitted state against `MEXICAN_STATES`, and passes it to `registerForEvent`. Existing events remain compatible because the config defaults to hidden and optional and the database column is nullable.

## Data Flow

1. Admin configures `fields.state.visible` and `fields.state.required` in the event form builder.
2. Public registration renders the state dropdown only when `visible` is true.
3. The server action rejects unknown values and rejects an empty value when required.
4. `registerForEvent` stores the value on the primary attendee; companions remain `NULL` because the field is public-primary-only.
5. Registration queries expose the nullable attendee state to the table and CSV layers.

## Testing

- Schema/config tests cover all 32 states and the legacy default.
- Public action tests cover hidden, optional, required, and invalid state values.
- Service tests cover persistence on the primary attendee.
- CSV/model tests cover the exported/displayed state.
- Existing checkbox tests and the full project suite remain green.
