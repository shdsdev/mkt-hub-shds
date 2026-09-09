# Design: QR List Redesign + One-Step Creation Modal

## Context

User shared screenshots of Bitly's QRCG product as the target UX for the QR module: a list page
with grid/list toggle, filters, and search; a "Create QR code" button that opens a type picker;
a customization step; and a success panel with a download button. Scoped down (per user's own
decomposition) to two pieces for this pass: the list page redesign, and turning creation into a
modal — deferring advanced design customization (frames/shapes/per-corner styles) and new QR
content types (vCard, PDF, social profiles, etc.) to future work.

Within that, one behavior upgrade was also approved: today, creating a dynamic QR requires first
creating a short link on the Links page, then picking it from a dropdown on the QR page. The new
"Sitio web" creation flow collapses this: paste a destination URL, and one submit creates the
`link`, `short_link` (auto-slug, on the organization's first domain), and `qr_code` together —
matching the reference product's one-step flow.

## Scope

**In**: `/qr` page redesign (toolbar, filters, search, list/grid views, richer rows), a creation
modal with a 2-card type picker (Sitio web / Texto fijo) → form+live-preview → success panel, and
the new one-step "Sitio web" server action.

**Out**: QR content types beyond URL and fixed text (vCard, PDF, social, images, video, events,
barcode2D, coupons, comments — all deferred, no placeholder/disabled UI for them either, per
YAGNI), advanced design customization (frames, shape patterns, per-corner styles — stays as today:
background/foreground color, error correction level, logo), editing an existing QR code's
customization after creation (no such function exists today; not adding one here), and domain
selection in the one-step flow (auto-picks the organization's first domain; multi-domain picker is
future work if it turns out to matter).

## List Page (`/qr`)

Server component (`page.tsx`) fetches `qrCodes`, plus organization-wide `links`, `shortLinks`, and
`domains` to enrich each row (destination URL, short URL, status) without per-row queries, and
`countEventsForQrCode` per QR for scan counts (small lists — matches the existing per-row lookup
pattern already used on the Audit Log page). Passes enriched rows to a new client component,
`qr-list.tsx`, which owns all view state (view mode, filters, search — client-side over the
already-fetched list, no new query params or server round-trips):

- Toolbar: grid/list toggle, status filter (All/Active/Archived), type filter (All/Dynamic/Static),
  search input (matches destination URL, payload, or short slug, case-insensitive substring)
- Empty state: centered message + "Crear código QR" button
- Each row/card: QR thumbnail (`<img src="/qr/[id]/download?format=png">`, reusing the existing
  download route — no new endpoint needed for thumbnails), type + created date, status badge, short
  URL with a copy button (dynamic) or the payload text (static), destination link (dynamic only),
  scan count, actions: view analytics (dynamic only, links to `/analytics/[linkId]`), download
  (PNG, and SVG when no logo — same constraint the download route already enforces), archive (when
  active)

## Creation Modal

`create-qr-modal.tsx`, opened by the "Crear código QR" button, two screens:

1. **Type picker**: two cards, "Sitio web" and "Texto fijo". No other cards — the product only
   supports these two content types right now.
2. **Form + live preview**, based on the chosen type:
   - **Sitio web**: destination URL input + background/foreground color + error correction level +
     logo upload — same fields as today's dynamic form, minus the short-link dropdown. Live preview
     calls the existing `/qr/preview` route in `payload` mode using the raw destination URL as a
     stand-in (the encoded value differs slightly from the final short URL, but colors/logo/shape
     preview identically — an accepted simplification, not worth a second preview mode for this).
   - **Texto fijo**: unchanged from today's static form, moved into the modal.
   - On submit, a **success panel** replaces the form: "¡Tu código QR está listo!", the real QR
     (via the download route once the row exists), a "Descargar PNG" button, and a close button.
     No "Personalizar" button — that flow doesn't exist yet.

## One-Step "Sitio web" Server Action

New `createWebsiteQrCodeAction` in `app/(protected)/qr/actions.ts`:

1. `checkRateLimit(user.id)` — same 30/min limiter as every other mutation
2. Validate `destinationUrl` + customization fields (Zod, same rules as today's forms)
3. Look up the organization's domains; if none exist, return an error telling the user to add one
   on the Links page first (existing `createDomainAction` already covers that case — no new UI)
4. `createLink` → `createShortLink` (auto-slug, first domain) → `createDynamicQrCode`, sequentially
   — no DB transaction wrapping these three inserts. The rest of the codebase doesn't use
   `db.transaction()` either (checked); a failure between steps could leave an orphaned
   link/short-link with no QR, which is an accepted, low-probability simplification consistent with
   existing conventions, not a new gap introduced by this feature.
5. `recordAudit({ action: "create", resourceType: "qr_code", ... })` — same single-entry policy
   already used for the campaigns/links "create" actions (the incidental link/short-link creation
   underneath isn't separately audited, matching how `createShortLinkAction` isn't audited today)
6. Returns the created QR code's id so the modal can show the success panel

`createDynamicQrCodeAction` (the old "pick an existing short link" flow) and `DynamicQrForm` are
removed — nothing else in the codebase references them (checked), and the new one-step flow fully
replaces that UX per the approved decision.

## Testing

No new pure logic to unit test — this is UI composition + an orchestration action reusing already-
tested service functions (`createLink`, `createShortLink`, `createDynamicQrCode` have no new
logic). Verified via `pnpm check` and a real browser click-through: create a website QR end-to-end,
confirm it appears correctly in the list with the right destination/short URL/scan count, filter
and search for it, download it, archive it.

## Open Questions

None.
