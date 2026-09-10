# Design: QR Visual Customization, Saved Templates, 4-Step Wizard, Themed Scrollbar

## Context

User shared screenshots of a competitor product's QR design panel (body/eye/eye-frame shapes,
frames, preset logos, saved templates) and asked for the same flow. Reached through a
brainstorming session that also surfaced two more requests: split the wizard's single scrollable
form step into shorter steps (less scroll per step), and theme the browser's default scrollbar to
match the dark UI instead of the native white one.

Supersedes the "advanced design customization ... stays as today" exclusion in both
`2026-09-09-qr-list-and-creation-modal-design.md` and `2026-09-10-qr-creation-wizard-design.md`.

## Scope

**In**: body/corner-square/corner-dot shape pickers using `qr-code-styling`'s built-in catalog (no
hand-drawn shapes), preset logos (globe, "SCAN ME") as alternate `logoUrl` values, saved design
templates (new table, org-scoped), restructuring the creation wizard from 2 steps
(type → one long form) to 4 (type → details → data → design), and a themed scrollbar applied
app-wide.

**Out**: decorative frame graphics (the "MARCOS" section in the reference — "SCAN ME" card-style
borders). No library ships these; replicating them is hand-drawn SVG overlay work disproportionate
to the value here. Explicitly cut per the brainstorming session — revisit only if requested again.
Also out: gradient fills (the library supports them "for free" but it's new scope, not asked for);
editing an existing QR's design after creation (still doesn't exist, unchanged from prior specs).

## Rendering Engine Swap

Today `src/modules/qr/service.ts` renders every QR with the `qrcode` npm package
(`QRCode.toBuffer`/`toString`), which only understands solid-square modules, a foreground/
background color, and an error-correction level — no shape API. Replacing it with
`qr-code-styling` (Node-compatible via `jsdom` for its `type: "svg"` mode, per its own documented
Node.js usage — no `node-canvas` native build needed) is not additive; it fully replaces the
render path so there is exactly one QR renderer, not two running in parallel for
"styled vs. default" codes. Existing rows (all shape columns NULL) render through the same code
path with `type: "square"` for every shape option — the library's default — so their PNG/SVG
output is visually unchanged.

**Bonus this swap enables, not additional scope**: today `[id]/download/route.ts` refuses SVG
export whenever a QR has a logo ("SVG export is not available for a QR code with a logo") because
the old library's SVG mode can't embed a raster image. `qr-code-styling`'s SVG mode can
(`imageOptions.saveAsBlob`), so that restriction is simply lifted as a side effect of the swap —
no separate design decision needed.

`exportQrPng`/`exportQrSvg` in `modules/qr/service.ts` keep their existing signatures (still take
an encoded value + a customization object) — only their internal implementation changes, so
`/qr/[id]/download`, `/qr/preview`, and `qr-success-panel.tsx` need no changes beyond widening the
customization type with the new shape fields.

## Data Model

New columns on `qr_codes` (migration, same pattern as the previous QR-wizard migration —
`pnpm db:generate`, review, `pnpm db:migrate`):

```
qr_codes
  dots_type            qr_shape_type NOT NULL DEFAULT 'square'   -- body modules
  corners_square_type  qr_corner_type NOT NULL DEFAULT 'square'  -- eye frame (outer)
  corners_dot_type     qr_corner_type NOT NULL DEFAULT 'square'  -- eye ball (inner)
```

```
qr_shape_type enum:  square | rounded | dots | classy | classy-rounded | extra-rounded
qr_corner_type enum: square | dot | rounded | dots | classy | classy-rounded | extra-rounded
```

(Two separate enums because the library's own `dotsOptions.type` union excludes `'dot'` while
`cornersSquareOptions.type`/`cornersDotOptions.type` both include it — mirroring the library's
actual type constraints instead of inventing one enum both fields awkwardly share.)

No new column for logo presets — "globe" and "SCAN ME" are just alternate values written into the
existing `logo_url` column (pointing at static assets shipped with the app, see below), exactly
like a user-uploaded logo. No corner-color column or control at all: corners and body always
render in the single existing `foreground_color` — there's no independent corner color picker and
no toggle for it (the reference's "Usar el color del código QR" toggle implies an off-state with a
separate corner color, which would need its own picker; cut entirely rather than build a toggle
that does nothing in the one-color-always model).

New table for saved templates:

```
qr_design_templates
  id                    uuid PK
  organization_id       uuid NOT NULL REFERENCES organizations
  name                  text NOT NULL
  dots_type             qr_shape_type NOT NULL
  corners_square_type   qr_corner_type NOT NULL
  corners_dot_type      qr_corner_type NOT NULL
  background_color      text NOT NULL
  foreground_color      text NOT NULL
  error_correction_level qr_error_correction_level NOT NULL
  logo_url              text
  created_at            timestamptz NOT NULL DEFAULT now()
```

Applying a template in the wizard copies its seven design fields into the step's local state — it
does not link the created QR back to the template row (no `template_id` FK on `qr_codes`); a
template is a starting point to copy from, not a live relationship, matching "Restablecer diseño"
in the reference implying design fields are just current values, freely diverging after applied.

## Preset Logo Assets

Two new static SVG files under `public/qr-presets/` (`globe.svg`, `scan-me.svg`) — simple, small,
authored for this project (not fetched from the reference product). The design step's logo control
becomes: "Sin logo" / "Subir el tuyo" (existing `LogoUpload`) / two preset buttons that set
`logoUrl` to `/qr-presets/globe.svg` or `/qr-presets/scan-me.svg` directly, no upload round-trip.

## Wizard Restructure (2 steps → 4)

`create-qr-modal.tsx`'s `screen` state gains steps; `QrWizardShell`'s `step`/`totalSteps` props
already support an arbitrary step count (built generic on purpose in the prior pass), so the shell
itself needs no changes — only how many times it's rendered in sequence and what each step holds.

1. **Tipo** (unchanged — six cards).
2. **Detalles**: Nombre, Agrupar en (`GroupSelect`), Foto de ubicación (`PlacementImageUpload`).
3. **Datos**: the kind-specific content fields (URL / vCard / email / SMS / WiFi fields), plus the
   UTM checkbox+section for "Sitio web" only — unchanged fields, just moved off the old single
   mega-step.
4. **Diseño**: color de fondo/primer plano, nivel de corrección, logo (subir/presets), selector de
   plantilla guardada (applies fields, doesn't navigate away), forma del cuerpo (6 swatches), forma
   del marco del ojo (7 swatches), forma del ojo (7 swatches), checkbox "Guardar como plantilla"
   (+ name input when checked) — submit button moves here, since it's the last step.

`QrSharedFields` (today: name + grouping + placement + colors + error-correction + logo, all in
one block) splits along this line: a slimmed version for step 2 (name + grouping + placement only)
and a new `QrDesignFields` component for step 4 (colors + error-correction + logo + shapes +
template picker + save-as-template) — `QrSharedFields` stops being one bag of everything, matching
what actually groups together now.

Live preview: `useQrPreview`/`/qr/preview` already recompute on every relevant field change via a
400ms-debounced POST — extending its request/response schema with the three new shape fields is
enough; the hook and route's shape (client posts params, server renders, returns an image) doesn't
change, so the earlier lesson (never import server-rendering code into a client component) isn't
at risk here — the client still only ever talks to the route over `fetch`.

## Themed Scrollbar

Global CSS in `app/globals.css` (not scoped to the wizard) — `::-webkit-scrollbar` /
`-thumb`/`-track` sized thin, colored from the existing `--muted`/`--muted-foreground` tokens (not
new literals), plus `scrollbar-color` for Firefox. Applies everywhere a scrollbar can appear (the
wizard's step content, the QR list, anywhere else), consistent with the app-wide reach the user
asked for rather than a wizard-only patch.

## Out of Scope, Explicitly

- Decorative frame graphics ("MARCOS") — no library support, cut per this session's decision.
- Gradient fills — the library supports them but it's unrequested scope.
- Per-corner color independent from the body color — no control for it at all, see Data Model.
- Editing a QR's design after creation, or linking a created QR back to the template it was
  copied from.
