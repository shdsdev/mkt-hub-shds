# Design: Phase 5 — QR Generator

## Context

`docs/ROADMAP.md` Phase 5: static/dynamic modes, customization, error-correction, PNG/SVG export.
The `qr` module's data layer and basic PNG/SVG export already exist from Phase 2
(`src/modules/qr/db.ts`, `service.ts`) — this phase wires it into real UI and decides what
"customization" means for MVP: colors, error-correction level, and (per the user, expanding
scope beyond the original SPEC.md §11 wording) an embedded logo, which requires Supabase Storage's
first real integration in this codebase.

## Scope

**In**: color customization (background/foreground) with live preview, error-correction level
(auto-forced to H when a logo is present), logo upload to Supabase Storage and compositing into
the exported PNG, a `/qr` page (dynamic + static creation, list, PNG/SVG download).

**Out**: SVG export with an embedded logo (PNG only for logo'd QR codes — an SVG with a raster
logo embedded loses portability; users who want a logo export PNG). Print run tracking (Phase 6).

## Image Compositing

`qrcode` (already installed) renders the QR itself but has no logo-compositing capability. Add
`sharp` (the standard Node image library; prebuilt binaries work cleanly in the Alpine Docker
image already in use) to: render the QR to a PNG buffer, overlay the logo image centered on top,
and return the final composited PNG buffer.

**Legibility rule**: when a logo is present, error-correction is force-set to **H** (tolerates up
to ~30% occlusion) — the user cannot pick a lower level once a logo is attached. Logo size is
capped at **22% of the QR's area** (standard industry safe zone) regardless of the uploaded
image's original dimensions; `sharp` resizes it to fit before compositing.

## Storage

New Supabase Storage bucket `qr-logos`, private, path-scoped by organization
(`{organization_id}/{qr_code_id}.{ext}`). The dynamic-QR creation form uploads the logo file
directly from the browser to Storage via the Supabase JS client (binary never passes through our
own server) and the resulting public URL is stored in a new nullable `qr_codes.logo_url` column.
This is the first code in the project touching Storage — bucket creation and RLS-equivalent
path-scoping happen in this phase's migration/setup, not deferred.

## Schema Change

`qr_codes` gains: `background_color` (text, hex, default `#1c130f`), `foreground_color` (text, hex,
default `#f7eeeb`), `error_correction_level` (enum L/M/Q/H, default M), `logo_url` (text, nullable).
All four are cosmetic/export-time fields — they don't affect the redirect resolution invariants
from Phase 3.

## UI (`/qr`, same pattern as `/links` and `/campaigns`)

- **Dynamic QR form**: select an existing link or short link (Phase 2 data), color pickers with
  live preview (client-side calls a preview endpoint that re-renders the composited PNG on
  color/logo change, debounced), optional logo upload, error-correction selector (disabled/forced
  to H once a logo is attached).
- **Static QR form**: free-text payload, same color/logo/error-correction controls, no link
  association (matches the existing `createStaticQrCode` CHECK constraint from Phase 2).
- **List**: generated QR codes with PNG/SVG download buttons (SVG only enabled when no logo is
  set).

## Testing

TDD on the one piece of pure logic: the logo-size-cap calculation (given a QR pixel size, compute
the max logo dimensions at 22%) and the "logo present forces EC level H" rule. Compositing itself
(`sharp` calls) and the Storage upload flow are verified in a real browser against the local
Supabase stack, matching every prior phase — including actually scanning a generated QR (or at
minimum decoding it programmatically) to confirm a logo didn't break legibility.

## Open Questions

None.
