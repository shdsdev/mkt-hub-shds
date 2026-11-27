# Custom Tag Colors and Input Focus Design

## Goals

1. Allow each event registration category/tag to use any custom HEX color.
2. Keep existing named colors compatible with stored event configurations.
3. Prevent category inputs from losing focus after the first typed character.

## Design

### Custom colors

- Keep the existing named palette as valid values for backwards compatibility.
- Add six-digit HEX values such as `#8B5CF6` as valid occupation colors.
- Replace the category color select in the event editor with a native color picker plus a HEX text input.
- Store the normalized HEX value in `registrationFormConfig.occupations[].color`.
- Render custom colors with inline styles while preserving the existing named-color Tailwind classes.
- Choose readable foreground text based on the color luminance.
- Keep existing color values unchanged for events that already use the named palette.

### Stable category rows

- Do not use the editable category value or label as a React key.
- Use a stable row identity for the editor render, preserving focus while the value changes.
- Continue validating the editable category identifier with the existing schema.

## Verification

- Schema tests accept valid HEX colors and reject malformed values.
- Editor tests confirm the color picker and HEX input are rendered.
- Editor tests confirm typing multiple characters into an identifier preserves the input value and focus.
- Presentation tests confirm custom colors generate inline background/text styles.
- Run focused tests, typecheck, and lint.
