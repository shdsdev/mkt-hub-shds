# Design: Analytics Geo Drill-Down + Richer Best-Day/Best-Location Cards

## Context

Follow-up to the org-wide Analytics dashboard (`docs/superpowers/specs/2026-09-15-org-analytics-dashboard-design.md`,
implemented). User asked whether state/province-level location data could be captured — starting
from "can I see this by state when the country is Mexico" — confirmed feasible and generalized:
`geoip-lite` (already the geo source for `geoCountry`/`geoCity`) already returns a `region` field
on every lookup (verified directly: a Mexico test IP returned `region: "SLP"`, San Luis Potosí's
ISO 3166-2 subdivision code) — no new geo provider needed, only persisting a value that's already
computed and discarded today.

While reviewing this, the user also compared the "Mejor día"/"Mejor ubicación" stat cards against
the Bitly reference and asked for feature parity: the reference shows the actual date, the
previous period's absolute value (not just the percent), and a country flag.

## Scope

**In**: capturing `region` (same best-effort, nullable posture as `referrer`); an on-demand,
per-country region breakdown surfaced as an inline expand/collapse on each row of the "Por
ubicación" table; enriching `StatCard` to show the best day's date, both cards' previous-period
absolute value alongside the percent, and a flag on the best-location card.

**Out**: a region-code-to-full-name lookup table (raw codes shown, same convention already used
for country codes today — no new mapping table). Tie-handling when two locations/days are equally
best (explicitly simplified away — the reference's "United States & United Kingdom" tied display
is not replicated; ties just show the first row found). Computing region breakdowns for every
country upfront (lazy, per-row, on expand only — avoids inflating the main dashboard payload for
countries nobody drills into). Any changes to the trend chart, device donut, referrer list, or map
— unchanged from the already-implemented dashboard.

## Data Model

One migration, additive and nullable — no backfill needed, same posture as the `referrer` column:

```
tracking_events
  region   text NULL   -- ISO 3166-2 subdivision code from geoip-lite (e.g. "SLP", "TX"), shown
                        -- raw/untranslated — same convention as geo_country today. Null whenever
                        -- geoip-lite can't resolve one (same as geo_country/geo_city already can be).
```

Captured in `src/modules/redirects/http.ts`'s `handleRedirect` — the same `geoip.lookup(ip)` call
already resolving `geo?.country`/`geo?.city` also has `geo?.region`; this just stops discarding it.

## Service Layer

- `getOrgRegionBreakdown(organizationId, eventType, country, from, to): Promise<BreakdownRow[]>` —
  same shape/query pattern as `getOrgBreakdowns`'s country dimension, additionally filtered by
  `geoCountry = country` and grouped by `region` instead. Called lazily (see UI section), not part
  of the main dashboard payload.
- `getOrgBestDay` and `getOrgBestLocation` widen their return types to include the raw previous-
  period value they already compute internally and currently discard:
  `{ ..., percentChange: number | null, previous: number }`. `getOrgBestDay`'s `previous` is the
  previous period's average daily count (already computed, just also returned, rounded for
  display); `getOrgBestLocation`'s `previous` is the same country's raw count in the previous
  period (already computed as `previousCount` internally).

## API

New route `app/(protected)/analytics/data/region/route.ts`:
`GET ?surface=qr|links&country=<code>&from=...&to=...` → `{ regions: BreakdownRow[] }`. Same auth/
org-scoping/query-parsing posture as the existing `/analytics/data` route.

## UI

- `LocationTable` rows become interactive: clicking a row toggles an inline expanded state for
  that country. On first expand, fetches `/analytics/data/region` for that country (cached in
  local state afterward — re-expanding the same row doesn't re-fetch); shows a short loading state,
  then renders the region rows indented below, same row styling (code + % of that country's total +
  count) as the top-level list. Collapses on a second click. No data is fetched for countries never
  expanded.
- `StatCard` gains two changes:
  - An optional `dateLabel` prop, rendered above the value — used by the "Mejor día" card
    (formatted via the same `date-fns` + `es` locale pattern already used elsewhere in this
    codebase, e.g. `"9 de septiembre de 2026"`).
  - The trend line changes from `"±X% {comparisonLabel}"` to `"±X% vs {previous} {comparisonLabel}"`,
    using the new `previous` field from the widened service return types.
  - An optional `flag` prop (the same regional-indicator-emoji trick `LocationTable` already uses),
    rendered before the value — used by the "Mejor ubicación" card, built from `bestLocation.country`.

## Testing

Unit tests for the region-breakdown query shape follow the same pattern already used for the
country/device breakdown functions (no new test infrastructure). No change needed to
`percent-change.test.ts` — the `previous` field is a plain pass-through of an already-computed
value, not new calculation logic. UI verified manually in the running app, per this session's
established convention.
