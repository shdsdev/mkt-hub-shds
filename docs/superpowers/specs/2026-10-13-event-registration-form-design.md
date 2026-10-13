# Event Registration Form Configuration Design

## Goal

Extend the public event registration form and its embed so each event can configure visible and required fields, collect participant preferences and consent, support one companion, and avoid nested scrolling.

## Scope

This change covers:

- Per-event form configuration in the administration panel.
- Participant, companion, client-brand, interest, and consent fields.
- Server-side validation against the saved event configuration.
- Administration visibility for requests that require follow-up.
- Responsive embed sizing without nested scroll containers.
- Regression coverage for existing events.

This change does not create a general-purpose form builder. The supported field types and option sets remain controlled by the application.

## Decisions

### Configuration storage

Store a versioned, validated JSON configuration on the event record. This is preferred over a normalized field table because the supported field set is known, the change remains small, and the form can evolve without adding a migration for every new field.

The configuration must support:

- `visible` and `required` for name, email, phone, company, and job title.
- Companion enabled/disabled state with a hard maximum of one companion.
- Enabled client-brand options per event.
- Enabled interest options per event.
- Privacy and terms consent text plus URLs.
- Optional marketing-consent availability.
- A configuration version for registration traceability.

Existing events without an explicit configuration use defaults compatible with the current form.

### Initial required-field defaults

- Full name: required.
- Email: required.
- Phone: configurable.
- Company: configurable.
- Job title: configurable.
- Companion name and email: required when the companion feature is enabled and the companion is added.
- Privacy policy consent: required.
- Terms and conditions consent: required.
- Marketing communications consent: optional.

## Administration Experience

Add a **Form Configuration** section to the event edit screen.

- Each supported base field has **Show** and **Required** controls.
- Required can only be enabled when Show is enabled.
- Name and email are displayed as locked required fields.
- Phone, company, and job title can be independently configured.
- Companion configuration has an **Allow one companion** control.
- Client brands and interests use controlled multi-select option lists.
- Privacy and terms display editable text and URL fields, but remain required.
- Marketing communications has an independent optional control.
- The screen includes a compact summary of the resulting public form.
- Invalid combinations are rejected before persistence with a field-specific message.

## Public Form Experience

Render the form in these groups:

1. Personal information: full name, email, phone, company, and job title.
2. Companion: one optional companion with name and email.
3. Additional request: a checkbox to request more companions without creating additional companion rows.
4. Profile: client brand and interests as accessible multi-select checkboxes.
5. Consent: privacy policy, terms and conditions, and optional marketing communications.
6. Submission: inline validation and success state.

Required fields show a red dot and expose `aria-required`. Unsupported options are not rendered.

The request-for-more-companions checkbox stores a follow-up flag. It never creates fake or incomplete attendee records. Administration can use this flag to identify registrations requiring contact.

## Embed Layout and Sizing

The embed must not contain nested scroll containers. The form content should determine the document height naturally.

The embed sends its measured height to the parent page using `postMessage`. The parent validates the expected origin before applying the height. A minimum fallback height is retained for hosts that do not implement the resize listener.

This removes the current double-scroll behavior while preserving a usable fallback for unsupported host pages. Desktop and mobile layouts use the same content structure, with option groups stacked vertically on narrow screens.

## Data Flow and Validation

1. Administration edits the event form configuration.
2. The configuration is validated and persisted with a version.
3. The public form reads the event configuration and renders only enabled fields and options.
4. Client validation provides immediate feedback.
5. The server validates the submitted payload against the current event configuration.
6. The registration stores participant data, companion data, selected brands, selected interests, consent timestamps, and the configuration version.
7. The follow-up flag is stored when the participant requests more companions.
8. Successful registration returns the existing success state; validation errors preserve entered values.

Server validation must reject:

- Missing required values.
- More than one companion.
- Options not enabled for the event.
- Missing required privacy or terms consent.
- Malformed URLs or configuration values.

Double submission protection remains enabled.

## Compatibility and Migration

- Existing events receive the compatibility defaults when no configuration exists.
- Existing registration data remains readable.
- New fields are additive; no existing registration is rewritten.
- Configuration versioning allows future changes to interpret old registration metadata correctly.

## Testing Strategy

Cover the following cases:

- Events with default configuration.
- Events with different visible and required field combinations.
- Required-field validation in the browser and on the server.
- One companion accepted and a second companion rejected.
- Request-for-more-companions follow-up flag.
- Multiple client-brand and interest selections.
- Required and optional consent behavior.
- Rejection of disabled options submitted by a tampered client.
- Preservation of values after validation errors.
- Double-submit protection.
- Embed resizing on desktop and mobile without nested scroll.
- Administration validation for incompatible configuration.

## Out of Scope

- Arbitrary custom fields.
- Per-event custom validation rules.
- More than one directly registered companion.
- Automatic outreach to users requesting more companions.
- A new standalone form-builder subsystem.
