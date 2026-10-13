# Events Embeddable Registration Form

## Goal

Allow an administrator to embed an event's public registration form in WordPress, Wix, Webflow, or any site that accepts HTML, without duplicating registration logic outside the Hub.

## Scope

This change embeds only the registration form. The event landing page, hero image, agenda, sponsors, and public landing navigation remain outside the embed.

The form retains its existing behavior:

- Primary attendee registration.
- Optional company and job-title fields configured per event.
- Companion attendees.
- Capacity enforcement and waitlisting.
- Duplicate-email validation.
- UTM capture.
- Confirmation emails with QR passes and backup codes.
- Per-event outbound webhook notification.

## Architecture

### Public Embed Route

Add `app/events/embed/[slug]/page.tsx` as a public route dedicated to the embed surface.

The route:

1. Resolves the event with `getPublishedEventBySlugPublic(slug)`.
2. Returns a controlled unavailable state when the event is missing, a draft, or otherwise not publicly available.
3. Renders only `RegisterForm`.
4. Passes the event slug and the event's `collectCompany` and `collectJobTitle` settings to the form.
5. Reads supported `utm_*` query parameters and passes them to the form as hidden values.

The route must not expose event IDs, organization IDs, webhook URLs, webhook secrets, or administrative data.

### Reused Registration Flow

The embed reuses the existing `RegisterForm` and `registerForEventAction`. The server action continues to re-resolve the event by slug, validates all submitted fields, performs the transactional registration, and dispatches the existing email and webhook side effects.

No separate embed API or client-side registration implementation is introduced.

### Host-Site Snippet

The event edit interface will expose a copyable snippet similar to:

```html
<iframe
  src="https://hub.example.com/events/embed/workshop-mayo"
  style="width:100%;min-height:760px;border:0"
  loading="lazy"
  title="Formulario de registro">
</iframe>
```

The snippet must use the public event slug and the configured application origin. It must be valid when pasted into an HTML block in common site builders.

The initial implementation uses a safe minimum height rather than cross-origin auto-resizing. A `postMessage`-based resize protocol can be added later if testing demonstrates that fixed minimum height is insufficient for the dynamic companion fields.

## Behavior and Security

- Published events are embeddable.
- Draft, closed, and unknown events show a controlled unavailable message.
- Existing server-side validation remains authoritative.
- Existing success, waitlist, duplicate-email, invalid-data, and unavailable-event states render inside the iframe.
- The embed has no administrative actions.
- Webhook secrets and internal identifiers are never rendered into the page or snippet.
- Add a basic anti-spam measure to the public submission flow, preferably a honeypot field. Add IP-based rate limiting only if it matches infrastructure already available in the application; it must not replace server-side validation.
- The embed surface must not rely on CSS from the host site. Its layout and controls use the form's own styles.

## Administration UX

Add a **Formulario embebible** section to the event edit view containing:

- The public embed URL.
- A read-only HTML snippet.
- A copy action.
- A preview link that opens the embed route.

The section is available for any event, but the preview and embed only produce a usable form while the event is published.

## Testing Strategy

Add or update tests for:

- Published event embed rendering.
- Draft, closed, and unknown event handling.
- Normal registration through the embed flow.
- Configured optional fields.
- Companion attendees.
- Capacity and waitlist behavior.
- Duplicate-email and invalid-data responses.
- UTM propagation.
- Existing confirmation email and webhook behavior remaining connected to the shared action.
- Embed snippet generation using the event slug and application origin.

Manual verification must include a plain external HTML page and responsive mobile and desktop rendering. The final verification commands are the repository's available test, lint, and typecheck/build commands, including `pnpm test`.

## Non-Goals

- Exporting standalone static HTML that contains registration logic.
- Creating a public registration API for third-party clients.
- Rebuilding the form in each supported site builder.
- Embedding the complete event landing page.
- Adding a plugin for WordPress, Wix, or Webflow.
