# Design: Bulk QR Review Preview

In the **Review** step of the bulk QR wizard, render one QR preview using the selected shared design and the first valid CSV URL as a visual payload. This lets the operator confirm the batch styling before creation without changing any creation behavior.

## Location

Update `app/(protected)/qr/bulk/bulk-qr-import.tsx` only. Reuse `app/(protected)/qr/use-qr-preview.ts` as-is.

## Flow

1. When the wizard reaches **Review**, select the first URL in `preview.rows`.
2. Call `useQrPreview` with that URL as `payload` and the current shared `design` fields: background color, foreground color, error-correction level, logo, dots type, corner-square type, and corner-dot type.
3. Render the returned image once in the Review step with clear preview alt text.
4. When no valid row URL exists, render an empty state instead of an image.

The preview is illustrative: it encodes the raw first CSV URL because no short link exists before creation. It must not generate or reserve a short URL.

## Errors And Empty State

- A missing CSV preview, an empty valid-row list, or a missing first-row URL shows the empty state.
- Keep the existing `useQrPreview` request behavior. Its unavailable result, including a failed preview request, leaves the image absent and shows the same empty state; do not add a new API contract or error channel.
- Existing CSV validation errors remain in the CSV step and continue to block access to Review. Do not introduce row-level QR previews.

## Out Of Scope

Do not change bulk creation, server actions, short URLs, CSV parsing or validation, UTM behavior, results, saved templates, or the individual QR wizard.

## Minimum Test

Add or extend the bulk wizard component test to verify that Review passes the first valid CSV URL and the shared design to `useQrPreview`, and renders one preview image. Verify that an empty valid-row list renders the empty state and no image.

## Self-Review

- "First valid URL" means the first entry in `preview.rows`; invalid CSV rows are excluded from that collection by the existing parser.
- The preview is one shared-design image, not one image per CSV row.
- No placeholder decision remains: lack of a payload or returned preview URL uses the specified empty state.
