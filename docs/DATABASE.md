# Database: Marketing Hub

> Reconstructed from Engram memory (project "hub marketing") after the original repository at
> `E:/PROYECTOS/MKT/HUB Marketing` was deleted. Source observations:
> `sdd/marketing-hub-design/design`, `sdd/marketing-hub-phase0-foundation/spec` (ADR-005 update).
> Faithful in content and decisions; wording may differ from the original file. See
> `ARCHITECTURE.md` for the invariants this schema must satisfy.

## Tables

**Owned by Supabase Auth** (not application-managed, ADR-005): `auth.users`, plus Supabase's own
session/JWT/refresh-token tables. The app never creates its own credentials or sessions table.

**Application schema** (`public`): `organizations`, `users` (profile, FK to `auth.users.id`),
`domains`, `folders`, `tags`, `link_tags`, `campaigns`, `utm_presets`, `links`, `short_links`,
`qr_codes`, `print_runs`, `tracking_events`, `tracking_rollup_daily`, `audit_logs`.

### `public.users` (profile table, not a credentials store)

```
id               uuid PK, FK -> auth.users(id) ON DELETE CASCADE
organization_id  uuid FK -> organizations
role             user_role NOT NULL default 'MARKETING_USER'
status           user_status NOT NULL default 'active'
created_at       timestamptz NOT NULL default now()
```

`email` and `password_hash` live in `auth.users`, managed by Supabase Auth — this table only holds
what Supabase's schema doesn't: organization membership and the coarse role/status gate (I-6, I-7).

## Enums

- `user_role`: ADMIN / MARKETING_MANAGER / MARKETING_USER / VIEWER
- `user_status`
- `resource_status`: active / disabled / archived
- `campaign_status`
- `domain_verification_status`
- `short_link_kind`: link / qr
- `qr_mode`: dynamic / static
- `qr_static_kind`: text / vcard / email / sms / wifi (descriptive only — see below)
- `qr_shape_type`: square / rounded / dots / classy / classy-rounded / extra-rounded (QR body dots)
- `qr_corner_type`: `qr_shape_type`'s six values plus `dot` (eye frame/eye ball — the rendering
  library's corner styles allow one more option than its body-dot styles, so these are two
  distinct enums, not one shared between all three shape pickers)
- `tracking_source_type`
- `device_type`
- `audit_action`

## Key Relational Decisions

- **`short_links` is a separate table, not a slug column on `links`**: one destination can need
  multiple published addresses (per domain, per channel) with separate attribution. Folding it
  into `links` would duplicate link rows and destroy the single-source-of-truth invariant.
  `links` = destination, `short_links` = addresses resolving to it.
- **Static QR** is handled without weakening I-1 via a CHECK constraint:
  `(dynamic AND link_id NOT NULL AND short_link_id NOT NULL AND static_payload NULL) OR (static AND link_id NULL AND short_link_id NULL AND static_payload NOT NULL)`.
  A static QR is by definition untrackable and uneditable.
- **`print_runs`** references exactly one of `qr_code_id` / `short_link_id` (CHECK); `scan_rate =
  scans / SUM(quantity)`; no print run recorded → UI shows "no print run recorded", never 0% or
  100%.
- **`qr_codes.name`** is required (`NOT NULL`) and purely organizational — never encoded into the
  QR image itself, unrelated to `static_payload`/`link_id`. **`static_kind`** is likewise
  descriptive only (drives the list page's icon/label); every one of the five static content
  types still stores its final encoded string in `static_payload` — it does not relax the CHECK
  above. **`folder_id`**/**`campaign_id`** live on `qr_codes` itself (not only reachable via
  `links.folder_id`/`campaign_links`) so a static QR — which has no `link_id` — can still be
  grouped; the two are an either/or organizational tag, not a constraint-enforced invariant.
  **`placement_image_url`** is the photo of where a QR is deployed (a flyer, a magazine page), a
  separate concept from `logo_url` (embedded inside the QR image).
- **`qr-placement-images`** is a second public Storage bucket alongside `qr-logos` (same
  public/policy shape, 5 MB limit instead of 2 MB — real photographs, not small embedded logos).
  **`organizations.default_logo_url`** is an org-wide (not per-user) default pre-filled into new
  QR codes, set from Settings.
- **`qr_codes.dots_type`/`corners_square_type`/`corners_dot_type`** default to `'square'` (every
  pre-existing row gets this via the column default, no backfill needed — visually identical to
  the plain-square output the old renderer always produced). Purely cosmetic, same "never affect
  redirect resolution" group as `background_color`/`foreground_color`/`error_correction_level`.
- **`qr_design_templates`** is a saved-designs table (org-scoped: name + the seven design fields —
  the three shape columns, both colors, error-correction level, logo URL). Applying a template
  copies its fields into the creation wizard's in-memory state; there is no FK from `qr_codes` back
  to the template it was copied from — a template is a starting point, not a live binding, so
  editing a template later never retroactively changes any QR already created from it.
- **Soft-delete** is enforced in three layers: application check (authoritative for MVP), `ON
  DELETE RESTRICT` FKs from `tracking_events` / `print_runs`, and an optional `BEFORE DELETE`
  trigger as defense in depth (noted because partition drops eventually lapse the FK protection).
- **`audit_logs`** (plural) is append-only; `action = 'destination_change'` MUST capture
  before/after `destination_url` — recoverable forever, because a destination change silently
  redirects every printed piece.
- **Campaign status never gates redirect resolution** — a printed QR outlives the campaign it was
  created for.

## `tracking_events` (ADR-002)

`link_id NOT NULL` FK + nullable `short_link_id`, `qr_code_id`, `campaign_id` (denormalized at
ingest for historical attribution) + `source_type` enum (`qr_scan` / `link_click` /
`campaign_click`). A CHECK ties `source_type` to the populated FK. This table is monthly-range
**partitioned** by `created_at`; primary key is `(id, created_at)` because of partitioning.

Nullable `device_type`, `geo_country`, `geo_city`, `referrer` (normalized hostname of the HTTP
`Referer` header, `NULL` when absent, e.g. most QR scans opened directly from a camera app), and
`region` (ISO 3166-2 subdivision code from geoip-lite, e.g. `"SLP"`/`"TX"`, shown raw/untranslated
— same convention as `geo_country`) round out the best-effort, captured-at-insert-time metadata
columns.

### Indexes on `tracking_events` (all on the partitioned parent)

- `(link_id, created_at DESC)`
- `(campaign_id, created_at DESC) WHERE campaign_id IS NOT NULL`
- `(organization_id, created_at DESC)`
- `(qr_code_id, created_at DESC) WHERE qr_code_id IS NOT NULL`
- `(short_link_id, created_at DESC) WHERE short_link_id IS NOT NULL`
- `(visitor_hash, session_started_at)`
- `(organization_id, created_at DESC) WHERE is_bot = false`
- `(organization_id, geo_country, created_at DESC)`

### Hot-path index

`UNIQUE (domain_id, slug)` on `short_links`.

## Multi-Tenancy

`organization_id` on every core table from day one (I-6). No Row-Level Security and no
tenant-switching UI/logic in MVP — this locks in the expensive schema decision cheaply now while
deferring actual multi-tenant enforcement until/unless a second tenant is needed.

## Retention / Partitioning

Raw `tracking_events` rows: configurable **14-month** default retention (open legal question under
LFPDPPP, not a fixed engineering default) → nightly rollup into `tracking_rollup_daily` (kept
indefinitely, no visitor/IP hashes) → monthly job verifies rollup coverage before
`DROP TABLE tracking_events_YYYY_MM`. Roll up first, drop second, always.

## Migration Order (referenced by ROADMAP.md phase dependencies)

1. `organizations`, `users` (profile) (Phase 1 — Auth + Database; `auth.users` itself is
   provisioned by Supabase, not a Drizzle migration)
2. `domains`, `folders`, `tags`, `link_tags`, `campaigns`, `links`, `short_links`, `qr_codes`
   (Phase 2 — Link Management Core)
3. `print_runs` (Phase 6 — Campaigns)
4. `tracking_events`, `tracking_rollup_daily` (Phase 7 — Analytics)
5. `audit_logs` (Phase 9 — Security + Audit)

## Open Questions

- [ ] Legal retention period under LFPDPPP for IP-derived data.
- [ ] Exact permission matrix per role, specifically who may edit link destinations.
- [ ] Formal soft-delete/archive policy wording and who may perform it.
