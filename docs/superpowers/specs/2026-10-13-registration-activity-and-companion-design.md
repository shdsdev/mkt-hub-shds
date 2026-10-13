# Registration Activity and Companion Design

## Goal

Clarify the public registration form so professional activity is captured separately from job title, brand selection supports an explicit none option, and additional-companion requests appear in the companion section.

## Public Form

### Primary attendee

Keep the existing **Puesto** field unchanged and independently configurable. Add a separate required select:

- Label: **¿A qué te dedicás profesionalmente?**
- Help text: **Seleccioná la opción que mejor describe tu actividad.**
- Options:
  - Distribuidor/a
  - Fabricante
  - Arquitecto/a
  - Decorador/a
  - Instalador/a o técnico/a

The activity select is always required for the primary attendee.

### Companion

When the one-companion block is opened, render both fields independently:

- **Puesto del acompañante**, following the existing configurable job-title behavior.
- **¿A qué se dedica tu acompañante?**, using the same fixed options and required validation.

Move **Quiero agregar más acompañantes** below the companion fields. It is shown when the companion block is open and records a follow-up request; it does not create additional attendee rows.

## Brand Selection

Add **Ninguno** to the fixed client-brand options. It is mutually exclusive with Shades, BMighty, and Drapery:

- Selecting Ninguno clears the other brand selections.
- Selecting any brand clears Ninguno.
- Server validation rejects a submission containing Ninguno plus another brand.
- The existing multiple-brand behavior remains available when Ninguno is not selected.

## Persistence

Add an `occupation` field to `event_attendees`. Keep `jobTitle` unchanged. Store the fixed option value, not the translated label, so reporting remains stable.

Existing attendee rows remain valid with a nullable occupation during migration. New public submissions require occupation for the primary attendee and any companion.

## Validation

- Accept only the five fixed activity values.
- Reject missing primary activity.
- Reject missing companion activity when a companion is present.
- Reject unknown activity values submitted by a tampered client.
- Reject invalid brand combinations.
- Continue enforcing the existing configurable requirements for phone, company, and job title.

## Administration and Reporting

- Keep the existing **Puesto** configuration controls unchanged.
- No new admin toggle is required for activity because it is always mandatory.
- Show activity in the registration detail view.
- Append primary/companion activity to CSV output without changing existing column order.

## Out of Scope

- Adding an “Otro” activity option.
- Making activity configurable or optional.
- Replacing or renaming the existing job-title field.
- Increasing the directly registered companion limit above one.
