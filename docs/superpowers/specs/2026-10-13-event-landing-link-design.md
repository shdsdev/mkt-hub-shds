# Event Landing Link Design

## Goal

Make the public event landing page immediately discoverable from the event edit screen.

## User Experience

In the event edit header, below the current event status:

- Show the full public URL using the configured application origin and the event slug.
- Add a primary **View landing** button that opens the URL in a new tab.
- Add a secondary **Copy link** button.
- Show a short `Link copied` confirmation without reloading the page.
- Keep the public landing link separate from the existing embeddable-form settings.

## URL Contract

The public URL is `/events/<encoded-slug>`, built from the same `NEXT_PUBLIC_APP_ORIGIN` used by the embed helpers. The slug is required by the event model and must be URI-encoded before it is placed in the URL.

## Implementation Boundary

- Add a reusable event landing URL helper beside the existing embed URL helper.
- Pass the generated URL from the server page to the client event edit form.
- Render the URL and actions in the existing event edit header without changing the event update action or database schema.
- Use the existing client-side copy pattern from the embed settings component where applicable.

## Accessibility and Safety

- The new-tab link uses `target="_blank"` with `rel="noreferrer"`.
- The copy control is a real button with an accessible label.
- Copy feedback is visible text and does not replace the URL.
- No user-provided HTML is rendered.

## Testing

- The URL helper returns the expected origin and encoded slug without duplicate slashes.
- The edit page passes the landing URL to the client form.
- The edit form renders the URL, the new-tab action, and the copy action.
- Copy feedback changes after a successful clipboard write.
- The existing embed URL and snippet behavior remains unchanged.

## Out of Scope

- Changing the public landing page.
- Changing event slugs or routing.
- Changing the embed snippet.
- Adding analytics to landing-link clicks.
