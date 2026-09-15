# Analytics Geo Drill-Down + Richer Stat Cards Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [x]`) syntax for tracking. Work task-by-task, in order.

**Goal:** Capture region/state-level geo data (already available from `geoip-lite`, just not persisted today), surface it as a lazy, per-country expand on the "Por ubicación" table, and enrich the "Mejor día"/"Mejor ubicación" stat cards with the best day's date, each card's previous-period absolute value, and a flag on the location card.

**Architecture:** One additive nullable column (`region`), captured at the same call site as `geoCountry`/`geoCity`. The region breakdown is its own query + its own route, fetched lazily per country row (never bundled into the main dashboard payload) — avoids computing/shipping region breakdowns for countries nobody expands. `getOrgBestDay`/`getOrgBestLocation` widen to also return the raw previous-period value they already compute internally.

**Design doc:** `docs/superpowers/specs/2026-09-15-analytics-geo-drilldown-design.md`

## Global Constraints

- Follow ARCHITECTURE.md I-4: only import a module through its `index.ts`.
- Never import `@/modules/analytics` for anything beyond types into a client component — same rule as the parent dashboard plan. `LocationTable`'s region fetch goes through the new API route, never a direct service import.
- Preserve every pre-existing working-tree change; this plan only touches the files it lists.
- Do not commit until the user explicitly asks.

---

## File Structure

- Modify: `src/modules/analytics/db.ts` — add `region` column to `trackingEvents`.
- Modify: `src/modules/redirects/http.ts` — capture `geo?.region`, pass to `trackRedirect`.
- Modify: `src/modules/analytics/service.ts` — `trackRedirect` gains `region?: string`; add `getOrgRegionBreakdown`; widen `getOrgBestDay`/`getOrgBestLocation` return types with `previous`.
- Modify: `src/modules/analytics/index.ts` — export the new function.
- Modify: `docs/DATABASE.md`.
- Create: `drizzle/00NN_<generated>.sql`.
- Create: `app/(protected)/analytics/data/region/route.ts`.
- Modify: `app/(protected)/analytics/location-table.tsx` — interactive rows, lazy region fetch.
- Modify: `app/(protected)/analytics/stat-card.tsx` — `dateLabel`/`flag` props, richer trend line.
- Modify: `app/(protected)/analytics/org-dashboard.tsx` — thread `surface`/`from`/`to` into `LocationTable`, pass new fields into `StatCard`.

---

### Task 1: Schema — `region` Column

**Files:**
- Modify: `src/modules/analytics/db.ts`
- Test: `pnpm typecheck`, `pnpm db:generate`

- [x] **Step 1: Add the column**

```ts
// ISO 3166-2 subdivision code from geoip-lite (e.g. "SLP", "TX"), shown raw/untranslated — same
// convention as geo_country today. Null whenever geoip-lite can't resolve one.
region: text("region"),
```

Place it next to `referrer` in `trackingEvents`.

- [x] **Step 2: Typecheck, then generate + apply the migration**

Run: `pnpm typecheck`, then `pnpm db:generate` (expect one `ALTER TABLE "tracking_events" ADD
COLUMN "region" text`), then `pnpm db:migrate`.

- [x] **Step 3: Update `docs/DATABASE.md`**

Add `region` to the `tracking_events` column list, same line/style as the existing `referrer`
addition.

- [x] **Step 4: Do not commit.**

### Task 2: Capture `region`

**Files:**
- Modify: `src/modules/redirects/http.ts`
- Modify: `src/modules/analytics/service.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: `geo?.region` from the existing `geoip.lookup(ip)` call already in `handleRedirect`.

- [x] **Step 1: `trackRedirect` gains `region?: string`**

In `service.ts`, add `region?: string` to `trackRedirect`'s input type and to the
`buffer.enqueue(...)` call, same pattern as `geoCountry`/`geoCity`.

- [x] **Step 2: Pass it from `redirects/http.ts`**

```ts
geoRegion: geo?.region,
```

Add alongside the existing `geoCountry: geo?.country, geoCity: geo?.city,` in the
`trackRedirect({...})` call — reuses the same already-resolved `geo` object, no new lookup.

- [x] **Step 3: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [x] **Step 4: Do not commit.**

### Task 3: Service — Region Breakdown + Richer Best-Day/Best-Location

**Files:**
- Modify: `src/modules/analytics/service.ts`
- Modify: `src/modules/analytics/index.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Produces: `getOrgRegionBreakdown(organizationId, eventType, country, from, to): Promise<BreakdownRow[]>`.
- Changes: `getOrgBestDay`/`getOrgBestLocation` return types gain `previous: number`.

- [x] **Step 1: `getOrgRegionBreakdown`**

Same query shape as the existing `orgBreakdown` helper, additionally filtered by `geoCountry` and
grouped by `region` instead of the country column:

```ts
export async function getOrgRegionBreakdown(
  organizationId: string,
  eventType: AnalyticsEventType,
  country: string,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  const rows = await db
    .select({ label: trackingEvents.region, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        eq(trackingEvents.geoCountry, country),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(trackingEvents.region)
    .orderBy(desc(count()));
  return rows
    .filter((row) => row.label !== null)
    .map((row) => ({ label: row.label as string, count: row.count }));
}
```

- [x] **Step 2: Widen `getOrgBestDay`**

Change the return type to `{ date: string; count: number; percentChange: number | null; previous:
number }` and return `previous: Math.round(prevAverage)` (the average it already computes,
rounded — matches the reference's whole-number display, e.g. "33").

- [x] **Step 3: Widen `getOrgBestLocation`**

Change the return type to `{ country: string; count: number; percentChange: number | null;
previous: number }` and return `previous: previousCount` (already computed, just also returned).

- [x] **Step 4: Export from `index.ts`**

Add `getOrgRegionBreakdown` to the barrel.

- [x] **Step 5: Typecheck**

Run: `pnpm typecheck`. Expected: `0` (call sites in `org-dashboard.tsx`/`stat-card.tsx` update in
Task 5).

- [x] **Step 6: Do not commit.**

### Task 4: Region Data Route

**Files:**
- Create: `app/(protected)/analytics/data/region/route.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Produces: `GET /analytics/data/region?surface=qr|links&country=<code>&from=...&to=...` →
  `{ regions: BreakdownRow[] }`.

- [x] **Step 1: Write the route**

Same auth/parsing posture as `app/(protected)/analytics/data/route.ts`, scoped to one country:

```ts
const querySchema = z.object({
  surface: z.enum(["qr", "links"]),
  country: z.string().min(1).max(10),
  from: z.string().date(),
  to: z.string().date(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const eventType = getAnalyticsSource(parsed.data.surface).eventType;
  const { from, to } = utcDayBounds({ from: parsed.data.from, to: parsed.data.to });
  const regions = await getOrgRegionBreakdown(
    user.profile.organizationId,
    eventType,
    parsed.data.country,
    from,
    to,
  );

  return NextResponse.json({ regions });
}
```

- [x] **Step 2: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [x] **Step 3: Do not commit.**

### Task 5: UI — Interactive Location Table + Richer Stat Cards

**Files:**
- Modify: `app/(protected)/analytics/location-table.tsx`
- Modify: `app/(protected)/analytics/stat-card.tsx`
- Modify: `app/(protected)/analytics/org-dashboard.tsx`
- Test: `pnpm typecheck`, browser check (Task 6)

**Interfaces:**
- Consumes: `GET /analytics/data/region` (Task 4).

- [x] **Step 1: `LocationTable` — interactive rows**

Add `surface: AnalyticsSurface` (type-only import) and `from`/`to: string` props (the caller
already holds these as formatted strings for the main fetch — pass the same ones down instead of
re-deriving). Local state: `expanded: string | null` (which country's row is open — only one at a
time keeps this simple) and a `regionCache: Record<string, BreakdownRow[]>` (fetched-once-per-
country memo). Clicking a row:

```ts
async function toggleRow(country: string) {
  if (expanded === country) {
    setExpanded(null);
    return;
  }
  setExpanded(country);
  if (regionCache[country]) return; // already fetched

  const params = new URLSearchParams({ surface, country, from, to });
  const response = await fetch(`/analytics/data/region?${params}`);
  if (!response.ok) return;
  const json: { regions: BreakdownRow[] } = await response.json();
  setRegionCache((prev) => ({ ...prev, [country]: json.regions }));
}
```

Render: each `<li>` becomes a `<button>` (or gets an `onClick` + `role="button"`/keyboard handling
for accessibility) instead of a plain row. When `expanded === row.label`, render an indented
sub-`<ul>` below it: a short loading state while `regionCache[row.label]` is undefined, "Sin datos
de región." if the fetch resolves to an empty array, otherwise each region row (code + % of that
country's total + count) with the same row styling as the top-level list, indented
(`className="ml-4 ..."`).

- [x] **Step 2: `StatCard` — `dateLabel`/`flag` props, richer trend line**

```tsx
export function StatCard({
  label,
  value,
  dateLabel,
  flag,
  percentChange,
  previous,
  comparisonLabel,
}: {
  label: string;
  value: string | null;
  dateLabel?: string;
  flag?: string;
  percentChange: number | null;
  previous?: number;
  comparisonLabel: string;
}) {
  ...
  {dateLabel && <p className="text-sm font-medium">{dateLabel}</p>}
  <div className="mt-1 flex flex-wrap items-baseline gap-2">
    <span className="text-2xl font-bold text-accent">
      {flag && <span aria-hidden className="mr-1">{flag}</span>}
      {value}
    </span>
    {percentChange !== null && (
      <span ...>
        {...} {Math.abs(percentChange).toFixed(1)}%
        {previous !== undefined ? ` vs ${previous.toLocaleString()} ${comparisonLabel}` : ` ${comparisonLabel}`}
      </span>
    )}
  </div>
```

Keep the existing `value === null` empty-state branch unchanged. `previous` is optional so the
component doesn't hard-require it (defensive, matches the rest of this dashboard's null-tolerant
props).

- [x] **Step 3: `org-dashboard.tsx` — thread the new fields through**

- Update the local `DashboardData` type: `bestDay`/`bestLocation` gain `previous: number`.
- Best-day `StatCard`: add `dateLabel={data?.bestDay ? formatBestDayDate(data.bestDay.date) : undefined}`
  (format via `date-fns` + `es` locale, matching the pattern already used in
  `event-analytics-panel.tsx`/`org-trend-chart.tsx` — e.g. `format(parseISO(date), "d 'de' MMMM 'de' yyyy", { locale: es })`)
  and `previous={data?.bestDay?.previous}`.
- Best-location `StatCard`: add `flag={data?.bestLocation ? countryFlag(data.bestLocation.country) : undefined}`
  (export `countryFlag` from `location-table.tsx` instead of duplicating it — one flag-emoji helper,
  reused) and `previous={data?.bestLocation?.previous}`.
- Pass `surface={surface}` and the same `from`/`to` strings already computed for the main fetch's
  `URLSearchParams` into `<LocationTable>` (hoist that date formatting out of the `useEffect` so
  both the fetch and the props can use it, rather than computing it twice).

- [x] **Step 4: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [x] **Step 5: Do not commit.**

### Task 6: Browser Verification

**Files:** none

- [x] **Step 1: `pnpm dev`, open `/analytics`**

Confirm "Mejor día" now shows a formatted date above the count, and "Mejor ubicación" shows a flag
before the country code — both cards' trend line now includes the previous absolute value (e.g.
"+21.2% vs 33 vs promedio del período anterior" — double-check the comparison label doesn't read
awkwardly once `previous` is prefixed in; adjust the label text if it does).

- [x] **Step 2: Expand a country row in "Por ubicación"**

Click a country with real data (seed more if needed — the existing demo-data seed script pattern
from the prior task can be reused/adapted, or run a one-off insert setting `region` on a few
existing rows). Confirm a loading state appears briefly, then region rows render indented below.
Click again to collapse. Click a different country and confirm it fetches independently (its own
cache entry) without affecting the first one's cached data.

- [x] **Step 3: Confirm no double-fetch on re-expand**

Expand a country, collapse it, expand it again — confirm (via Network tab or
`read_network_requests`) the region endpoint is called once, not twice, for that country in one
session.

- [x] **Step 4: `pnpm build`**

Expected: exits `0`.

---

## Self-Review

### Spec Coverage

- `region` capture (schema, `handleRedirect`, `trackRedirect`): Tasks 1–2.
- Lazy per-country region breakdown (service, route, UI): Tasks 3–5.
- Best-day date, best-location flag, previous-value trend text on both cards: Tasks 3, 5.
- Explicit cuts (region-name lookup table, tie handling, eager region computation): none of the
  tasks above introduce them.

### Incomplete-Step Scan

Task 6 Step 1 flags one open wording question (whether the enriched trend-line copy reads
naturally once `previous` is spliced into `comparisonLabel`) to resolve during browser
verification rather than guessing the exact string now — the data/logic side is fully specified,
only the label phrasing is left to that pass.

### Type Consistency

- `BreakdownRow` (`{ label: string; count: number }`) is reused as-is for region rows — no new
  type needed, region rows are structurally identical to device/country/referrer rows.
- `getOrgBestDay`/`getOrgBestLocation`'s widened return types are mirrored exactly in
  `org-dashboard.tsx`'s local `DashboardData` type (Task 5 Step 3) so a mismatch is easy to spot.
