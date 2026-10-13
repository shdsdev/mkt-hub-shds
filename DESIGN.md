# Design

<!-- impeccable:design-schema 1 -->

## Scope

This file documents the **public events surface only** (`app/events/**`: landing, registration form, self-cancel). The admin app under `app/(protected)/**` keeps its own pre-existing dark/teal "Marketing Hub" system, untouched by this round — see `## Coexistence` below for why these are two separate worlds in one app.

## World

Soft pastel editorial/wellness-storefront, directly pinned by the user from the 21st.dev "YukoHealth Storefront" template preview (not literally cloned — no subscription to its source was available; built from the visible preview as a style reference). Warm off-white ground, one restrained blue→rose gradient reserved for the display headline only, ambient soft-blurred color fields (not photography, not SVG illustration) for atmosphere.

## Palette

- Ground: `#FBF7F1` (warm cream, not pure white)
- Ink (primary text): `#201D1A`
- Secondary text: `#4A4740`
- Muted text / captions: `#6B6A63`
- Hairline / borders: `#201D1A` at 10–15% opacity
- Error: `#C2577B`
- Headline gradient: `#5C86C9 → #9F84C9 → #D98CA6` (blue → violet → rose), `bg-clip-text`, used only on the event name — a deliberate exception to the "no gradient text" default, pinned by the brief's own reference image.
- Ambient blob fields: `#CFE1F6` (blue), `#F7D6E3` (rose), `#DCEEE2` (mint), each a `radial-gradient` at low opacity behind a heavy blur — never a shipped raster, pure CSS.
- Primary action (CTA pills): solid `#201D1A` fill, `#FBF7F1` text — the one high-contrast, non-pastel element, deliberately, since the pastel palette alone would fail button-text contrast.

## Type

- Display (`font-display`, Fraunces italic, `next/font/google`, CSS var `--font-fraunces` → Tailwind token `--font-display`): event name (hero), section headings ("Agenda", form title, success states). Registered additively in `app/globals.css`'s `@theme inline` block — does **not** touch `--font-heading` (Jersey 25), which stays the admin app's digital/LCD display face everywhere else.
- Body (`font-sans`, Inter — already the app-wide default, reused as-is): descriptions, form labels, agenda item titles, captions.
- No new mono/display face added beyond Fraunces.

## Components (this surface's own vocabulary — not the admin's shadcn `<Input>`/`<Button>`)

- **Pill chip** (date/location fact above the headline): white/70 + `backdrop-blur-sm`, full rounded, hairline border. Factual, not a decorative "kicker" — craft-floor's kicker ban applies to label text that only restates the heading; this chip carries its own distinct fact (date, location).
- **Form fields**: white fill, `rounded-2xl`, hairline border, focus ring in the violet accent at 15% — plain native `<input>`, not the dark-theme `<Input>` primitive.
- **Buttons**: full-pill, solid ink fill for primary actions; hairline-outline pill for secondary (add companion); underlined text-only for destructive/tertiary (remove companion).
- **Hero image**: real `<img>`, `rounded-[2rem]`, `object-cover`, offset+blur shadow (`shadow-[0_24px_60px_-20px_...]`) — never a geometric clip-path mask.
- **Agenda**: a plain ordered list with a hairline top-rule between rows (time in display face, title in body face) — explicitly not same-size icon+heading+text cards (craft-floor ban).
- **Sponsor logos**: a bare flex-wrap row, grayscale at rest, full color on hover — no card chrome, no per-sponsor label unless explicitly named.

## Coexistence with the admin world

`app/events/layout.tsx` is a nested layout (not the root) that adds the Fraunces font-variable class to this subtree only; it does not and cannot re-declare `<html>`/`<body>` (owned by `app/layout.tsx`, which always applies `.dark` and the admin's `AuraBackground`). Every color on this surface is therefore authored as an explicit Tailwind utility (`bg-[#FBF7F1]`, not `bg-background`) rather than the shared CSS-variable tokens, which resolve dark everywhere in this app — that's a structural necessity, not a stylistic choice, and it's why this surface and the admin surface can never silently drift into sharing tokens by accident.

## Content model (admin-authored, this round)

`events.heroImageUrl` (nullable), `events.agenda` (jsonb array, admin-ordered, no relational child table — the array order IS the display order), `events.sponsorLogos` (jsonb array). Admin UI: `app/(protected)/events/event-image-upload.tsx` (direct-to-Supabase-Storage upload, bucket `event-landing-images`), `agenda-editor.tsx`, `sponsor-logos-editor.tsx` — all wired into both the create and edit admin forms via one hidden JSON input per list field.

## Known gaps / not yet covered by this round

- `app/events/cancel/[token]` (self-cancel landing) was not restyled — still the plain unstyled markup from PR3. Same visual world should extend there next.
- No true mobile-viewport screenshot was captured this session (the available browser-automation screenshot tool returned a fixed resolution regardless of window resize in this environment); mobile correctness rests on the responsive Tailwind classes in source (`sm:` breakpoints, `grid-cols-1 sm:grid-cols-2`), not on a verified capture.
- The full `impeccable` finish-reviewer subagent pass was not spawned this round (time-budget substitution, disclosed here) — only the mechanical `detect` pass ran, plus one in-thread visual check via live browser screenshots at one viewport size.
