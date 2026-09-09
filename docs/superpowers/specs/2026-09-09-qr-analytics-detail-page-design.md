# Design: QR Analytics Detail Page

## Context

User shared a Bitly QRCG detail-page screenshot as the target for what happens when you click a
QR card in `/qr`: a header with the QR/short URL/destination, total and unique scan counts, a
time-series chart with a date range and day/week/month granularity, an OS breakdown, and top
countries/cities. User confirmed building the whole thing, including OS/geo, after being shown
what that actually requires.

Investigation before designing surfaced two things that reshape the plan:

1. **`deviceType` and `geoCountry` columns already exist on `tracking_events` but nothing has ever
   populated them.** No OS/geo capture exists today — this needs new capture logic at the redirect
   hot path, not just new UI.
2. **`countEventsForQrCode` has been silently broken since it was written** (used today on the `/qr`
   list page's scan-count column). `trackRedirect()` accepts a `qrCodeId` parameter, but
   `handleRedirect()` (`src/modules/redirects/http.ts`) never passes one — a QR scan and a plain
   link click aren't actually distinguishable by `qrCodeId` at all, because the only signal the
   redirect handler has is which route was hit (`/r/[slug]` vs `/q/[code]`), not which specific QR
   image was scanned. The correct fix is to stop trying to key by `qrCodeId` and instead count by
   `shortLinkId` + `sourceType = 'qr_scan'` — every hit to `/q/<slug>` for a short link *is* that
   link's QR scan traffic, by construction (SPEC.md §25's route-based source-type split). This
   requires no new hot-path query.

## Scope

**In**: OS + coarse geo (country/city) capture at the redirect hot path (`ua-parser-js` +
`geoip-lite`, both local/offline — no network calls, no API keys, consistent with the existing
in-process rate-limiter/buffer architecture), a `geo_city` column, the `countEventsForQrCode` fix,
new aggregate queries (unique visitors, day/week/month-grouped rollup, device/country/city
breakdowns), a redesigned `/analytics/[linkId]` page with a chart (`recharts`, new dependency —
verified legitimate/maintained against the npm registry directly), and making dynamic QR cards on
`/qr` clickable through to their analytics page.

**Out**: "Reiniciar escaneos" (resets the reference product's scan history) — conflicts with I-7
(no hard-delete, archive/disable only); not building it. Campaign start/end date fields, "Tirada"/
"Medio" chips on the header (don't map cleanly to our schema — not inventing new campaign fields
for this). Static QR codes stay non-clickable to an analytics page (untrackable by design,
DATABASE.md). Retroactive backfill of OS/geo on already-existing events (impossible — the raw
User-Agent/IP were never stored, by design, I-8).

## Capture: OS + Geo

`src/modules/redirects/http.ts`, `handleRedirect()` — alongside the existing bot check, add two
more synchronous, local computations before enqueueing (matches the existing fire-and-forget,
non-blocking hot path, I-5 — no new I/O, no new query):

- **Device/OS**: `ua-parser-js` on `request.headers.get("user-agent")` → `os.name` (e.g. "iOS",
  "Android", "Windows", undefined → stored as `null`).
- **Geo**: `geoip-lite.lookup(ip)` where `ip` comes from `x-forwarded-for` (first entry) or
  `x-real-ip` — standard reverse-proxy headers, work identically whether deployed behind Vercel,
  nginx, or Traefik/Docker Compose. Returns `{ country, city }` or `null` when unresolvable (e.g.
  local dev with no proxy in front, or a private/loopback IP) — stored as `null` in that case, not
  a synthetic placeholder.

We already resolve-and-discard the raw IP today for nothing (it's not stored) — this doesn't change
that: only the derived country/city land in the database, never the IP itself, consistent with I-8.

`src/modules/analytics/db.ts`: add `geoCity: text("geo_city")` next to the existing `geoCountry`.

## Service Layer (`src/modules/analytics/service.ts`)

- Fix `countEventsForQrCode(qrCodeId)`: resolve the QR's `shortLinkId` (one query), then count
  `tracking_events` where `shortLinkId` matches and `sourceType = 'qr_scan'`. Same signature, same
  callers (`/qr` list page), just correct now.
- `countUniqueScansForQrCode(qrCodeId)`: same filter, `count(distinct visitor_hash)`.
- `getScansForLinkGrouped(linkId, granularity, from, to)`: `day` reads `tracking_rollup_daily`
  directly; `week`/`month` run a `date_trunc` aggregation over the same table in SQL. Returns
  `{ bucket, scansHuman }[]` for the chart (bot traffic excluded from the visual, matching how the
  Overview page already treats "human" as the meaningful number).
- `getDeviceBreakdownForLink` / `getCountryBreakdownForLink` / `getCityBreakdownForLink(linkId,
  from, to)`: `GROUP BY` + `count(*)` + `ORDER BY count DESC LIMIT 5` against raw `tracking_events`
  within the given range (only the events that have geo/device populated — i.e. everything from
  when this ships onward).

## `/analytics/[linkId]` Page

Restructured into two parts:

1. **Header card**: QR thumbnail + short URL (with copy button, same component pattern as the `/qr`
   list), destination URL as the page's primary heading, type + status badges, created date, a
   "Download" link (reuses `/qr/[id]/download`) — needs the QR code's id, so the page now also
   loads the `qr_codes` row for this link (a dynamic link has at most one). Stats row: total scans
   and unique scans (all-time, using the two fixed/new count functions above).
2. **"Scans" section**: a date-range control (`<input type="date">` pair, defaulting to the last 30
   days) and a granularity `<select>` (Day/Week/Month), a `recharts` bar chart of scans over the
   selected range/granularity, the existing CSV export link, and — beneath the chart — two small
   "Top countries" / "Top cities" lists and one "By device" list, all scoped to the same date range.
   Client component (`scans-panel.tsx`) owns the range/granularity state and re-fetches via a small
   route handler (`/analytics/[linkId]/data?...`) rather than a full page reload per control change.

## `/qr` List — Card Click

`qr-list.tsx`: `QrRow`/`QrCard` for a **dynamic** QR become a `Link` to `/analytics/[linkId]`
wrapping the whole card; the existing per-action icons (`stopPropagation` on their click handlers,
since they sit inside the now-clickable card) keep working independently — download/archive/copy
still do their own thing without also navigating. Static QR cards are not wrapped (no analytics
route exists for them) — same as today's "Analytics" icon already being conditional on `mode ===
"dynamic"`.

## Testing

TDD for the one piece of pure logic worth it: the week/month bucket-grouping SQL is data-layer, not
unit-testable in isolation, so instead verify it against the real local Supabase stack (insert a
few dated rollup rows via a throwaway script, confirm the grouped query returns the right buckets).
Verified overall via `pnpm check` and a real browser pass: click a QR card, confirm the analytics
page loads with correct scan counts, trigger a couple of real redirects through `/q/<slug>` and
confirm a device/country entry appears (country/city will show "Unknown" in local dev without a
real public IP in front — expected, not a bug).

## Open Questions

None.
