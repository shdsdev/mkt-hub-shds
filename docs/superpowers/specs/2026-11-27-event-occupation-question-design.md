# Event Occupation Question Design

## Goal

Allow each event administrator to customize the question shown above the event's client-category tags, while keeping the same question for the primary attendee and any companion.

## Requirements

- Add one event-scoped configurable question for the occupation/category field.
- Default the question to `¿A qué te dedicás profesionalmente?`.
- Preserve the default for existing events whose configuration does not contain the new property.
- Let administrators edit the question from the registration-form configuration editor.
- Show the configured question in the editor preview.
- Use the configured question in the public form for the primary attendee.
- Reuse the same configured question for the companion occupation field.
- Keep category values, labels, colors, enabled states, archival behavior, and validation unchanged.
- Preserve the existing required behavior of the occupation field.
- Reject invalid configuration values server-side using the existing configuration schema.

## Architecture

Extend the existing event `registrationFormConfig` object with a scalar `occupationQuestion` property. This keeps the question and its category definitions in the same event-scoped configuration and avoids introducing a second settings mechanism.

The configuration resolver supplies the compatibility default when the property is absent. The editor serializes the resolved configuration through the existing hidden `registrationFormConfig` field. Public and internal form consumers receive the resolved configuration and read the question from it.

The companion does not get an independent question setting. It inherits the event's `occupationQuestion`, ensuring both fields remain consistent.

## UI

Add a text input labeled `Pregunta de categoría` near the existing `Tipos de cliente` section. The input should:

- Be editable per event.
- Have an accessible label.
- Show the current resolved value.
- Update the existing live preview.
- Preserve the project's existing input styling and form serialization.

The public form should replace the hardcoded primary and companion occupation labels with the configured value.

## Validation

- Trim the value.
- Require at least one character.
- Limit the value to 160 characters.
- Use the default when loading legacy event configurations.
- Keep the occupation value validation based on active configured categories.

## Testing

- Configuration tests verify the default and valid custom question.
- Configuration tests reject blank or overlong questions.
- Editor tests verify the question input is rendered with the configured value.
- Public form tests verify the configured question is used for the primary and companion fields.
- Existing category and registration action tests remain green.

## Out of Scope

- Independent wording for the companion.
- Changes to category identifiers, labels, colors, or archival behavior.
- Changes to historical attendee data.
- Database migrations.
