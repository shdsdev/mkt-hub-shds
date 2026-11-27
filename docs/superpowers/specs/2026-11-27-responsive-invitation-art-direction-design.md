# Responsive Invitation Art Direction

## Goal

Make centered invitation artwork readable on desktop and mobile without moving or reintroducing the event location card overlay.

## Design

- Keep the event location card below the invitation image exactly as it is.
- Use the invitation's centered composition as the focal point at every viewport.
- On desktop, render a wide hero frame so the invitation remains horizontal and spacious.
- On mobile, render a portrait-oriented hero frame and crop only the empty horizontal margins around the centered artwork.
- Use `object-position: center` so the tree, title, copy, and icons remain in the focal area.
- Preserve rounded corners, the neutral image background, and the existing no-image fallback.

## Responsive behavior

- Desktop: wide aspect ratio close to the source artwork, with no meaningful content crop.
- Mobile: portrait aspect ratio close to the provided mobile reference; horizontal side margins may be cropped, while the full vertical invitation composition remains visible.
- The image must not overflow its rounded container or create horizontal page overflow.
- The location card remains a sibling below the hero image.

## Verification

- Add regression coverage for the responsive aspect-ratio and centered object-position classes.
- Confirm the location card remains outside the hero container.
- Run the focused landing test, typecheck, lint, and diff checks.
