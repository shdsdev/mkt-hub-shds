# Design: Phase 4 — UTM Builder

## Context

`docs/ROADMAP.md` Phase 4: "validation/encoding, presets, naming enforcement, direct-to-short-link/QR
flow." `docs/DATABASE.md` names `utm_presets` in its table list with no column detail — this design
fills that in. `docs/SPEC.md` §13 doesn't specify a naming-convention rule; resolved with the user:
**lowercase kebab-case**, normalized automatically (GA4/Google Ads de-facto standard — prevents
"Facebook"/"facebook"/"FACEBOOK" fragmenting as three sources in reporting).

## Scope

**In**: `utm_presets` table, a pure normalization/validation helper applied everywhere a UTM value
is saved (preset creation AND direct link creation/editing — no bypass), a preset dropdown on the
existing link form (Phase 2) that fills the text fields but stays editable, a presets management UI
alongside Domains on `/links`.

**Out**: nothing deferred — this phase is narrow by nature (SPEC.md's UTM Builder section is short).

## `utm_presets` Table (`src/modules/utm/db.ts`)

```
id               uuid PK
organization_id  uuid FK -> organizations
name             text NOT NULL (e.g. "Instagram Organic")
utm_source       text NOT NULL
utm_medium       text NOT NULL
utm_campaign     text NOT NULL
utm_term         text (nullable)
utm_content      text (nullable)
created_at       timestamptz NOT NULL default now()
```

## Normalization (`src/modules/utm/normalize.ts`, TDD'd)

`normalizeUtmValue(raw: string): string` — lowercases, trims, replaces runs of whitespace/invalid
characters with a single `-`, strips leading/trailing `-`. Rejects (throws/returns an error) an
empty result or one exceeding 255 characters. Applied to every UTM field on both `utm_presets` and
`links` before insert/update — a value typed by hand goes through the identical normalization a
preset's value does, so there's no bypass path.

## Link Form Integration

`links/actions.ts`'s `createLinkAction` (and the future edit path) normalizes `utmSource` /
`utmMedium` / `utmCampaign` (and `utmTerm`/`utmContent` if present) via the `utm` module's public
`normalizeUtmValue` before calling `links.createLink`. The link form (`link-form.tsx`) gets a
preset `<select>` populated from `listUtmPresets(organizationId)`; a small client-side `onChange`
copies the selected preset's source/medium/campaign into the existing text inputs — no server
round-trip, and the fields stay fully editable afterward. No preset selected = today's manual
behavior, unchanged.

## Presets Management UI

A "UTM Presets" card on `/links`, same pattern as the existing Domains card: a list of saved
presets and a small create form (name + the 3-5 UTM fields), normalizing on submit exactly like the
link form does.

## Testing

TDD on `normalizeUtmValue` (the one piece of real logic): case conversion, whitespace/invalid-char
collapsing, leading/trailing dash stripping, empty-after-normalization rejection, max-length
rejection. The preset dropdown → form-fill interaction and the full create/select/save flow are
verified in a real browser against the local Supabase stack, matching every prior phase.

## Open Questions

None.
