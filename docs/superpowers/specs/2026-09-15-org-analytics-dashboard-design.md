# Design: Org-Wide Analytics Dashboard

## Context

User shared screenshots of Bitly's "Analytics" dashboard (an aggregate view across all links/QR
codes, not scoped to one item) and asked whether a third nav tab replicating it made sense,
alongside the existing "Enlaces" and "Códigos QR" tabs. Reached through a short recommendation
exchange, then a full brainstorming session.

Today every analytics view in the app is scoped to one link or QR code
(`app/(protected)/analytics/[linkId]/page.tsx`). There is no aggregate, organization-wide view —
the closest thing is the "Resumen" page's single `Clics + escaneos (30d)` stat
(`getOrgTrafficLast30Days`), which has no breakdown, no date range, and no per-surface split. This
spec adds that aggregate view as a new page; the per-link detail pages are unchanged and continue
to exist side by side.

## Scope

**In**: a new `/analytics` page (third nav tab) showing an aggregate dashboard for the whole
organization, with a source selector (Enlaces vs Códigos QR — switches which data feeds the same
dashboard layout, never blends both at once), a shared date-range + "período anterior" comparison
control, a trend line chart, "mejor día"/"mejor ubicación" stat cards, a device breakdown donut, a
location table, a referrer breakdown, and a world map (via the `@mapcn/map` shadcn registry
component). Referrer tracking is new scope, added because the referrer breakdown card needs it: a
new `referrer` column on `tracking_events`, captured at event-insert time.

**Out**: editing/removing the existing per-link detail pages (unchanged). Any historical backfill
of `referrer` for events already recorded before this ships (new column starts `null` for all
prior rows — same posture as every other analytics column added to this table so far). A combined
Enlaces+QR view in one chart (explicitly rejected earlier for the per-link page — id 1508 — and
not requested here either; the selector switches the data source for one shared layout, it does
not mix values from both surfaces into one series). Org-level rollup pre-aggregation for
device/country/referrer (Approach B from the brainstorming discussion) — the breakdown queries hit
raw `tracking_events`, same as the existing per-link breakdown query, bounded by the same
already-accepted 14-month raw-event retention window (`docs/DATABASE.md` §Retention).

## Data Model

One migration, additive and nullable — no backfill needed:

```
tracking_events
  referrer   text NULL   -- normalized hostname of the HTTP Referer header (e.g. "instagram.com"),
                          -- null when absent (most QR scans: opened from a camera app, no
                          -- browser Referer to read). Displayed as "Directo" when null.
```

Captured in the same request-handling code path that already inserts a `tracking_events` row for a
short-link redirect or a QR scan — read `request.headers.get("referer")`, parse its hostname with
`new URL(...).hostname`, store that (not the full URL). Any parse failure (malformed header) stores
`null`, same as a missing header — never throws.

## Service Layer

New functions in `src/modules/analytics/service.ts`, each scoped by `organizationId` +
`surface: "link" | "qr"` + a date range (reusing the existing `{ from, to }` range shape already
used by the per-link chart) — generalizing the existing per-link functions from filtering by
`linkId` to filtering by `organizationId`, same query shapes otherwise:

- `getOrgTrendGrouped` — daily series summed from `tracking_rollup_daily` across every link/QR
  code in the org (`clicksHuman` for the "link" surface, `scansHuman` for "qr"). Backs the trend
  chart and its "vs período anterior" overlay. Rollup-backed, not raw-event-backed, so it isn't
  bounded by the 14-month raw retention window — same advantage the per-link chart already has.
- `getOrgTotals` — total interactions in range + % vs the immediately preceding period of equal
  length.
- `getOrgBestDay` — the single day with the most interactions in range + % vs previous period.
- `getOrgBestLocation` — the top country by interactions in range + % vs previous period.
- `getOrgBreakdowns` — three breakdowns in one call (device, country, referrer), each as
  `{ label, count, percent }[]` sorted descending — generalizes `getAnalyticsBreakdownsForLink`.
  Raw-event-backed, so bounded by the 14-month retention window, same as the existing per-link
  breakdown card today.

All five reuse the existing `sourceType` column (`qr_scan` / `link_click`) to filter by surface —
no new column needed for that split, it already exists per-row.

## Routing & Navigation

- New page: `app/(protected)/analytics/page.tsx` (the aggregate dashboard). Existing
  `app/(protected)/analytics/[linkId]/page.tsx` (per-item detail) is untouched — Next.js's App
  Router resolves `/analytics` and `/analytics/:linkId` as separate routes with no conflict.
- Sidebar: "Analytics" added as a third item in the same nav group as "Enlaces" and "Códigos QR".

## UI & Components

Every piece below reuses the app's existing design system (dark theme tokens, `Select`,
`bg-card`/`border-border` card shells, the trend/stat-indicator styling already used on the QR
analytics page) rather than introducing new visual language:

- **Source selector**: the shared `Select` component, options "Enlaces" / "Códigos QR". Controls
  which surface every widget on the page queries — switching it re-fetches everything at once.
- **Date range + "período anterior"**: the same shared calendar/range component the per-link chart
  already uses. Own state scoped to this page (not synced with the per-link pages' own range
  state).
- **Trend chart**: a new `OrgTrendChart` component, visually matching `EventAnalyticsPanel`'s chart
  (dashed cursor line, gradient/glow fill, custom single-row tooltip) by reusing its Recharts
  styling, but decoupled from a `linkId` — fed by `getOrgTrendGrouped` instead. Kept as a separate
  component rather than generalizing `EventAnalyticsPanel` itself, since that component's
  `linkId`/`dataUrl`/CSV-export contract is specifically per-link shaped and shouldn't grow an
  org-wide branch inside it.
- **"Mejor día" / "Mejor ubicación" cards**: same card shell + green trend-indicator style already
  used for the existing `+1.9% vs mitad anterior` stat on the QR analytics page.
- **Device donut**: Recharts `PieChart`, theme color tokens.
- **Location table**: country + interactions + % + trend, one row per country, sorted descending.
  Flags rendered as emoji derived from the stored ISO country code (no new icon dependency).
- **Referrer breakdown**: domain + interactions + %, same table styling as the location table.
- **Map**: `@mapcn/map` (installed via `pnpm dlx shadcn@latest add @mapcn/map`), fed
  `{ countryCode, count }[]` from `getOrgBreakdowns`'s country dimension. Its exact prop/rendering
  API is confirmed at implementation time once installed; this spec only commits to the data
  contract (country code + count), not to the component's internal API.
- **Empty states**: every card with no data in range shows the same "Sin datos en este rango."
  copy/style already used on the QR analytics page's "Países principales"/"Por dispositivo" cards.

## Testing

Unit tests (Vitest, same file-adjacent pattern as `csv.test.ts`/`logo.test.ts`) for the new
service-layer logic: cross-link summation correctness, period-over-period percent calculation, and
referrer-hostname normalization (including the malformed-header → `null` fallback). UI is verified
manually in the running app per this session's established convention — no e2e framework in this
repo.
