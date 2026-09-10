# Design: QR Creation Wizard, New Static Types, and QR Grouping

## Context

Supersedes the content-type scope of `2026-09-09-qr-list-and-creation-modal-design.md`, which
deferred everything beyond "Sitio web" and "Texto fijo" per YAGNI. User now wants four new static
content types (vCard, correo, SMS, WiFi), a mandatory name on every QR, UTM tagging for the
"Sitio web" type, an optional placement photo, and the ability to group any QR (static or dynamic)
into a folder or a campaign — plus an org-level default logo in Settings. Reached through a
brainstorming session; the user also asked to install and adapt a shadcn registry component
(`onboarding-screen`, from `registry.watermelon.sh`) as the visual base for the new modal.

## Scope

**In**: multi-step creation wizard replacing the current 2-screen modal; four new static QR types
(vCard, Correo electrónico, SMS, WiFi) alongside Sitio web and Texto fijo; a required `name` on
every QR; optional UTM tagging for Sitio web (reusing the existing `modules/utm` presets); an
optional placement-photo upload; an optional folder-or-campaign assignment for any QR type; an
org-level default logo in `/configuracion`, pre-filled into the wizard's logo step; adapting the
installed `onboarding-screen` shadcn component (adds `motion` + `react-icons`) into the wizard's
visual shell.

**Out**: advanced QR design customization (frames, shape patterns, per-corner styles — unchanged);
editing an existing QR's fields after creation (still doesn't exist); a proper multi-brand
"companies/clients" entity (resolved to reuse existing folders instead, see below); multi-domain
picker in the Sitio web step (still auto-picks the organization's first domain); campaign
assignment UI beyond a flat select (no nested/hierarchical grouping).

## Data Model

All changes live in `src/modules/qr/db.ts` (`qr_codes`) except the org default logo
(`src/modules/users/db.ts`, `organizations`). One migration (`pnpm db:generate` → review →
`pnpm db:migrate`).

```
qr_codes
  name                 text NOT NULL            -- backfilled before constraint is added, see below
  static_kind          qr_static_kind (nullable) -- text | vcard | email | sms | wifi; NULL when mode=dynamic
  placement_image_url  text (nullable)          -- Supabase Storage public URL, same pattern as logo_url
  folder_id            uuid REFERENCES folders  (nullable)
  campaign_id          uuid REFERENCES campaigns (nullable)

organizations
  default_logo_url     text (nullable)
```

- **`name` backfill**: the migration first runs
  `UPDATE qr_codes SET name = COALESCE(NULLIF(static_payload, ''), 'QR sin nombre')` (dynamic rows
  fall to the literal, since `static_payload` is NULL for them — a destination-URL backfill isn't
  worth a cross-table `UPDATE ... FROM links` for what's currently test/seed data only), then adds
  the column as `NOT NULL`. Going forward every creation path requires it — enforced by Zod
  (`.min(1)`) in every action, matching how every other required field in this codebase is
  validated at the action boundary rather than relying solely on the DB constraint for the error
  message.
- **`qr_static_kind` enum**: purely descriptive — used by the list page to pick an icon/label
  ("WiFi" instead of generic "Texto fijo"). It does not change the `qr_mode_fields_check` CHECK
  constraint or the dynamic/static model: every one of the five static kinds still stores its
  final encoded string in the existing `static_payload` column. `static_kind` is NULL for dynamic
  rows (mirrors how `static_payload` is already NULL there).
- **`folder_id` / `campaign_id` directly on `qr_codes`**: today `folders`/`campaigns` only attach
  to `links` (`links.folder_id`, the `campaign_links` join table), which excludes every static QR
  (no `link_id`) from both. Putting the FKs on `qr_codes` instead lets any QR — static or dynamic —
  be grouped, matching "para hacer conjuntos" for all types. The wizard's UI treats this as one
  either/or choice (a single select mixing folder and campaign names); the two columns are simply
  never both non-null in practice, but no CHECK enforces that — it's an organizational tag, not an
  invariant worth a DB constraint.
- **`organizations.default_logo_url`**: org-wide, not per-user (unlike the existing per-user
  `theme` column) — a brand asset, not a personal preference.

## Wizard Architecture

`create-qr-modal.tsx` keeps its screen-based state machine but collapses to three screens instead
of growing to eight: `"type" | "form" | "success"`, plus a `selectedKind` state
(`"website" | "text" | "vcard" | "email" | "sms" | "wifi"`). The `"form"` screen renders a shared
shell with the fields for whichever kind was picked — one shell, not six near-duplicate modals.

**`QrWizardShell`** (`app/(protected)/qr/qr-wizard-shell.tsx`, new) — the adapted
`onboarding-screen` component: rounded card, spring-animated progress bar (2 steps: "Elegir tipo",
"Detalles"), back button, left column for step content / right column for the live QR preview
(reuses `useQrPreview`, unchanged — every kind's payload, including vCard/WiFi/etc. strings, is
still just a string fed to the same preview endpoint). Only the shell's chrome and motion come from
the installed component; all copy and fields are QR-specific, written fresh.

Install path: `pnpm dlx shadcn@latest add https://registry.watermelon.sh/r/onboarding-screen.json`
lands the raw file at `src/components/watermelon/onboarding-screen.tsx` (per this project's
`components.json` alias, `components` → `src/components`) and adds `motion` + `react-icons` to
`package.json`. That raw file is then moved/rewritten into `qr-wizard-shell.tsx` — it isn't kept
as a general-purpose primitive elsewhere, so it doesn't belong under `src/components/`.

Type step: six cards (Sitio web, Texto fijo, vCard, Correo electrónico, SMS, WiFi), replacing
today's two-card grid — icon + label + one-line description each, static (no morph/hover-trigger
semantics needed, they're plain selectable cards, not action buttons).

## Shared Fields (every kind)

Rendered once in the shell, above the kind-specific fields:

- **Nombre** — required text input.
- **Agrupar en** (optional) — a select mixing `listFolders()` and `listCampaigns()` results
  (grouped `<optgroup>`s: "Carpetas" / "Campañas"), plus a default "Sin agrupar". Writes to
  `folderId` or `campaignId` depending on which list the chosen option came from.
- **Foto de ubicación** (optional) — a new `PlacementImageUpload` component, copy-pasted structure
  from `logo-upload.tsx` (same direct-to-Storage upload, new bucket `qr-placement-images`), shown
  as a small thumbnail once uploaded.
- Color de fondo / primer plano, nivel de corrección, logo — unchanged from today, logo input
  pre-fills from `organizations.default_logo_url` when set (still replaceable per QR).

## Kind-Specific Fields → Payload Generation

Every non-website kind produces a plain string that becomes `static_payload`, built **server-side**
in the action (not client-side string concatenation) so validation and escaping are centralized in
one place instead of duplicated between a client preview and the server:

| Kind | Fields | Generated payload |
|---|---|---|
| Texto fijo | contenido (free text) | unchanged — the field's own value |
| vCard | nombre completo, teléfono, email, empresa (opt.), sitio web (opt.) | vCard 3.0 (`BEGIN:VCARD\nVERSION:3.0\nFN:...\n...\nEND:VCARD`); commas/semicolons/backslashes in field values are escaped per the vCard spec |
| Correo electrónico | dirección, asunto (opt.), cuerpo (opt.) | `mailto:` URI, `subject`/`body` URL-encoded query params |
| SMS | número, mensaje (opt.) | `sms:<número>?body=<mensaje>` (URL-encoded) |
| WiFi | SSID, contraseña, seguridad (WPA/WEP/ninguna), oculta (checkbox) | `WIFI:T:<WPA\|WEP\|nopass>;S:<ssid>;P:<password>;H:<true\|false>;;`, with `;`, `,`, `\` in SSID/password backslash-escaped per the format |

Each kind gets its own Zod schema + server action (`createVCardQrCodeAction`, etc.) in
`app/(protected)/qr/actions.ts`, all calling the existing `createStaticQrCode` with the generated
payload and the new `staticKind` + `name`/`folderId`/`campaignId`/`placementImageUrl` fields
threaded through. `createStaticQrCode` in `modules/qr/service.ts` gains those fields on its input
type; no new service function needed since the shape doesn't otherwise change.

## Sitio Web: UTM + Grouping

`createWebsiteQrCodeAction` and `WebsiteQrForm` gain:

- A "Agregar etiquetas UTM" checkbox that reveals the same fields as `link-form.tsx`'s UTM section
  (preset select calling the existing `applyPreset` pattern, then source/medium/campaign inputs) —
  no new UTM logic, these values pass straight through to the existing `createLink()` call, which
  already accepts `utmSource`/`utmMedium`/`utmCampaign`.
- An inline note near the destination-URL field: "Tu QR usará un enlace corto automáticamente" —
  clarifying that the shortener the user asked for already exists (every dynamic QR has always
  encoded the short URL, never the raw destination); no new toggle, just messaging.
- The same shared Nombre / Agrupar en / Foto de ubicación fields as every other kind.

## Settings: Default Logo

New section in `app/(protected)/settings/page.tsx`, alongside Temas: an upload control (reusing the
`logo-upload.tsx` pattern) writing to `organizations.default_logo_url` via a new
`updateDefaultLogoAction`. Org-wide, so any signed-in user can currently change it — matching this
codebase's existing "coarse ADMIN-vs-rest gate for destructive actions only" RBAC posture
(ARCHITECTURE.md): setting a default logo isn't destructive, so it isn't gated.

## List Page (`/qr`)

`QrListRow` gains `name`, `staticKind`, `placementImageUrl`, `folderId`/`folderName`,
`campaignId`/`campaignName`. `QrHeading` shows `row.name` as the title (falling back to the
existing destination-URL/payload heading only for the pre-migration rows whose backfilled name is
the literal "QR sin nombre" placeholder — same visual slot, just a different string, no new
conditional needed). Subtitle line gains the folder/campaign name (when set) next to the existing
type/date/status. Static-kind rows show a kind-specific icon (vCard/Email/SMS/WiFi) instead of the
generic static icon.

## Out of Scope, Explicitly

- No new "Companies/Clients" entity — folders cover the "which client this QR is for" need per the
  session's decision.
- No editing of an already-created QR's kind-specific fields (vCard details, WiFi credentials,
  etc.) — matches today's "static QR is untrackable and uneditable by design" invariant
  (DATABASE.md), which this feature doesn't relax.
- No validation that a WiFi/vCard/etc. payload round-trips through a real QR scanner during this
  pass — format correctness is reviewed against the published specs, not device-tested.
