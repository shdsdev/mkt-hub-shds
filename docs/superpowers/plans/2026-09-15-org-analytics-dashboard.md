# Org-Wide Analytics Dashboard Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Work task-by-task, in order — later tasks depend on earlier schema/service changes compiling first.

**Goal:** Add a third nav tab, "Analytics", showing an aggregate dashboard across every link or every QR code in the organization (source picked by a selector, never blended), with a shared date-range + "período anterior" comparison, a trend chart, "mejor día"/"mejor ubicación" stat cards, a device breakdown, a location table, a referrer breakdown (new tracked data), and a world map (`@mapcn/map`).

**Architecture:** Every new query generalizes an existing per-link query from filtering by `linkId` to filtering by `organizationId`, reusing the same two data sources the per-link page already uses: `tracking_rollup_daily` for the trend line and totals (fast, not bounded by raw-event retention), and raw `tracking_events` for breakdowns (bounded by the existing 14-month retention, same as today). No new schema for aggregation — one additive column (`referrer`) is the only schema change. The dashboard page is a new route (`/analytics`) that coexists with the existing per-link detail route (`/analytics/[linkId]`) — neither changes the other.

**Design doc:** `docs/superpowers/specs/2026-09-15-org-analytics-dashboard-design.md`

## Global Constraints

- Follow ARCHITECTURE.md I-4: only import a module through its `index.ts`.
- **Never import `@/modules/analytics` for anything beyond types into a client component without checking first** — `service.ts` pulls in `@/db/client` (Drizzle/postgres). Client components (the dashboard shell, chart, widgets) only ever fetch from the new `/analytics/data` route and get JSON back — never import service functions directly, same posture as the QR module's client/server split.
- `eventType: AnalyticsEventType` (`"qr_scan" | "link_click"`) is the type every new service function takes — not a new "surface" type. The UI-level `AnalyticsSurface` ("qr" | "links") only exists at the route/page boundary, converted via the already-existing `getAnalyticsSource(surface).eventType`.
- Preserve every pre-existing working-tree change; this plan only touches the files it lists.
- Do not commit until the user explicitly asks.

---

## File Structure

- Modify: `src/modules/analytics/db.ts` — add `referrer` column to `trackingEvents`.
- Create: `src/modules/analytics/referrer.ts`, `src/modules/analytics/referrer.test.ts` — hostname normalization.
- Modify: `src/modules/analytics/service.ts` — `trackRedirect` gains `referrer?: string`; add `getOrgTotals`, `getOrgBestDay`, `getOrgBestLocation`, `getOrgTrendGrouped`, `getOrgBreakdowns`.
- Modify: `src/modules/analytics/date-range.ts` — add `previousPeriod`, `daysBetween`.
- Modify: `src/modules/analytics/index.ts` — export the new functions/types.
- Modify: `src/modules/redirects/http.ts` — read + normalize the `Referer` header, pass to `trackRedirect`.
- Create: `drizzle/00NN_<generated>.sql` — the new column.
- Modify: `docs/DATABASE.md`.
- Create: `app/(protected)/analytics/page.tsx` — the aggregate dashboard route (server component).
- Create: `app/(protected)/analytics/data/route.ts` — JSON data endpoint for the dashboard.
- Create: `app/(protected)/analytics/org-dashboard.tsx` — client shell (source selector, date range, fetch, layout).
- Create: `app/(protected)/analytics/org-trend-chart.tsx` — trend line (current vs período anterior).
- Create: `app/(protected)/analytics/stat-card.tsx` — "Mejor día"/"Mejor ubicación" card.
- Create: `app/(protected)/analytics/device-donut.tsx`.
- Create: `app/(protected)/analytics/location-table.tsx`.
- Create: `app/(protected)/analytics/referrer-list.tsx`.
- Create: `app/(protected)/analytics/org-map.tsx`.
- Modify: `app/(protected)/sidebar.tsx` — third nav item.
- Modify: `package.json` — `@mapcn/map` (installed via shadcn CLI).

---

### Task 1: Schema — `referrer` Column

**Files:**
- Modify: `src/modules/analytics/db.ts`
- Test: `pnpm typecheck`, `pnpm db:generate`

- [ ] **Step 1: Add the column**

```ts
// Normalized hostname of the HTTP Referer header (e.g. "instagram.com"), null when absent —
// most QR scans have no Referer at all (opened from a camera app, not a browser). Displayed as
// "Directo" when null, never as an empty string.
referrer: text("referrer"),
```

Place it next to `geoCity` in `trackingEvents` — same "captured at insert time, nullable,
best-effort" group.

- [ ] **Step 2: Typecheck, then generate the migration**

Run: `pnpm typecheck` (expect `0`), then `pnpm db:generate`. Expected: one new file under
`drizzle/` with a single `ALTER TABLE "tracking_events" ADD COLUMN "referrer" text` — nullable, no
default, no backfill needed (every prior row simply has `referrer = NULL`).

- [ ] **Step 3: Apply it**

Run: `pnpm db:migrate`. Expected: exits `0`.

- [ ] **Step 4: Update `docs/DATABASE.md`**

Add `referrer` to the `tracking_events` column list, one line, same style as the existing
`geo_country`/`geo_city` bullets.

- [ ] **Step 5: Do not commit.**

### Task 2: Referrer Normalization + Capture

**Files:**
- Create: `src/modules/analytics/referrer.ts`
- Create: `src/modules/analytics/referrer.test.ts`
- Modify: `src/modules/analytics/service.ts`
- Modify: `src/modules/analytics/index.ts`
- Modify: `src/modules/redirects/http.ts`
- Test: `pnpm typecheck`, `pnpm test -- referrer`

**Interfaces:**
- Produces: `normalizeReferrer(rawHeader: string | null): string | undefined`.
- Consumes (in `redirects/http.ts`): `request.headers.get("referer")`.

- [ ] **Step 1: `referrer.ts`**

```ts
// A raw Referer header is a full URL ("https://l.instagram.com/?u=..."); only the hostname is
// stored — not the full URL (privacy/prolixity, and matches how the dashboard groups by domain,
// not by exact page). A malformed or absent header returns undefined, same as each other, so the
// caller never needs to distinguish "missing" from "unparseable".
export function normalizeReferrer(rawHeader: string | null): string | undefined {
  if (!rawHeader) return undefined;
  try {
    return new URL(rawHeader).hostname || undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 2: `referrer.test.ts`**

Cases: a normal URL → hostname only (no path/query); `null` → `undefined`; empty string →
`undefined`; a malformed value (e.g. `"not-a-url"`) → `undefined`, no throw.

- [ ] **Step 3: Thread it through `trackRedirect`**

In `service.ts`, add `referrer?: string` to `trackRedirect`'s input type and to the
`buffer.enqueue(...)` call (same pattern as `deviceType`/`geoCountry`/`geoCity` — passed straight
through, no transformation here, normalization already happened at the call site).

- [ ] **Step 4: Export from `index.ts`**

Add `normalizeReferrer` to the barrel.

- [ ] **Step 5: Call it in `redirects/http.ts`**

```ts
const referrer = normalizeReferrer(request.headers.get("referer"));
```

Add alongside the existing `deviceType`/`ip`/`geo` computation, and add `referrer` to the
`trackRedirect({...})` call.

- [ ] **Step 6: Typecheck and run the referrer tests**

Run: `pnpm typecheck && pnpm test -- referrer`. Expected: both exit `0`.

- [ ] **Step 7: Do not commit.**

### Task 3: `previousPeriod` Helper

**Files:**
- Modify: `src/modules/analytics/date-range.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Produces: `previousPeriod(range: AnalyticsDateRange): AnalyticsDateRange`.

- [ ] **Step 1: Add the function**

```ts
// The immediately preceding period of equal length in days — the one, unambiguous definition of
// "período anterior" this feature uses everywhere it needs one. E.g. range 2026-09-01..2026-09-07
// (7 days) → previous is 2026-08-25..2026-08-31 (also 7 days, ending the day before `from`).
export function previousPeriod({ from, to }: AnalyticsDateRange): AnalyticsDateRange {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const spanMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}
```

- [ ] **Step 2: Add `daysBetween`**

Used by `getOrgBestDay` (Task 4 Step 3) to turn the previous period's total into a daily average —
lives here, next to `previousPeriod`, since both are pure date-range math with no DB dependency:

```ts
// Inclusive day count between two "YYYY-MM-DD" strings — e.g. "2026-09-01".."2026-09-07" is 7.
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [ ] **Step 4: Do not commit.**

### Task 4: Org-Level Service Functions

**Files:**
- Modify: `src/modules/analytics/service.ts`
- Modify: `src/modules/analytics/index.ts`
- Create: `src/modules/analytics/org-service.test.ts`
- Test: `pnpm typecheck`, `pnpm test -- org-service`

**Interfaces:**
- Consumes: `previousPeriod` (Task 3), `humanRollupColumn` (existing private helper, reused as-is).
- Produces: `getOrgTrendGrouped`, `getOrgTotals`, `getOrgBestDay`, `getOrgBestLocation`,
  `getOrgBreakdowns`, `type OrgBreakdowns`.

- [ ] **Step 1: `getOrgTrendGrouped` — org-wide daily series**

Same shape as `getAnalyticsForLinkGrouped`, filtered by `organizationId` instead of `linkId`, and
**grouped by date** (unlike the per-link version, which needs no grouping because one row per date
already exists per link):

```ts
export async function getOrgTrendGrouped(
  organizationId: string,
  eventType: AnalyticsEventType,
  granularity: AnalyticsGranularity,
  from: Date,
  to: Date,
): Promise<AnalyticsBucket[]> {
  const humanColumn = humanRollupColumn(eventType);
  if (granularity === "day") {
    const rows = await db
      .select({ bucket: trackingRollupDaily.date, count: sum(humanColumn) })
      .from(trackingRollupDaily)
      .where(
        and(
          eq(trackingRollupDaily.organizationId, organizationId),
          gte(trackingRollupDaily.date, from.toISOString().slice(0, 10)),
          lte(trackingRollupDaily.date, to.toISOString().slice(0, 10)),
        ),
      )
      .groupBy(trackingRollupDaily.date)
      .orderBy(asc(trackingRollupDaily.date));
    return rows.map((row) => ({ bucket: row.bucket, count: Number(row.count ?? 0) }));
  }

  const truncUnit = granularity === "week" ? "week" : "month";
  const rows = await db.execute<{ bucket: string; count: number }>(sql`
    SELECT date_trunc(${truncUnit}, ${trackingRollupDaily.date}::date)::date::text AS bucket,
           sum(${humanColumn})::int AS count
    FROM ${trackingRollupDaily}
    WHERE ${trackingRollupDaily.organizationId} = ${organizationId}
      AND ${trackingRollupDaily.date} >= ${from.toISOString().slice(0, 10)}
      AND ${trackingRollupDaily.date} <= ${to.toISOString().slice(0, 10)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  return rows;
}
```

- [ ] **Step 2: `getOrgTotals` — current vs previous period**

```ts
async function sumRollupInRange(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<number> {
  const humanColumn = humanRollupColumn(eventType);
  const [row] = await db
    .select({ total: sum(humanColumn) })
    .from(trackingRollupDaily)
    .where(
      and(
        eq(trackingRollupDaily.organizationId, organizationId),
        gte(trackingRollupDaily.date, range.from),
        lte(trackingRollupDaily.date, range.to),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function getOrgTotals(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<{ current: number; previous: number; percentChange: number | null }> {
  const [current, previous] = await Promise.all([
    sumRollupInRange(organizationId, eventType, range),
    sumRollupInRange(organizationId, eventType, previousPeriod(range)),
  ]);
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : null;
  return { current, previous, percentChange };
}
```

- [ ] **Step 3: `getOrgBestDay`**

Definition (explicit, to remove any ambiguity): the single day with the most interactions in
range; its `percentChange` compares that day's count against the **average daily count of the
previous period** (not the previous period's own best day, and not a same-offset day — both would
add fragile edge cases at range boundaries for no clearer meaning).

```ts
export async function getOrgBestDay(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<{ date: string; count: number; percentChange: number | null } | null> {
  const humanColumn = humanRollupColumn(eventType);
  const [best] = await db
    .select({ date: trackingRollupDaily.date, count: sum(humanColumn) })
    .from(trackingRollupDaily)
    .where(
      and(
        eq(trackingRollupDaily.organizationId, organizationId),
        gte(trackingRollupDaily.date, range.from),
        lte(trackingRollupDaily.date, range.to),
      ),
    )
    .groupBy(trackingRollupDaily.date)
    .orderBy(desc(sum(humanColumn)))
    .limit(1);
  if (!best) return null;

  const prev = previousPeriod(range);
  const prevTotal = await sumRollupInRange(organizationId, eventType, prev);
  const prevDays = daysBetween(prev.from, prev.to); // from Task 3 Step 2
  const prevAverage = prevDays > 0 ? prevTotal / prevDays : 0;
  const count = Number(best.count ?? 0);
  const percentChange = prevAverage > 0 ? ((count - prevAverage) / prevAverage) * 100 : null;
  return { date: best.date, count, percentChange };
}
```

Import `daysBetween` alongside `previousPeriod` from `./date-range`.

- [ ] **Step 4: `getOrgBestLocation`**

Definition: the country with the most interactions in range; its `percentChange` compares that
same country's count against its own count in the previous period (a country you haven't seen
before in the previous period reads as `null`, not `+∞%` or `+100%`).

```ts
export async function getOrgBestLocation(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<{ country: string; count: number; percentChange: number | null } | null> {
  const { from, to } = utcDayBounds(range);
  const [best] = await db
    .select({ country: trackingEvents.geoCountry, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(trackingEvents.geoCountry)
    .orderBy(desc(count()))
    .limit(1);
  if (!best || !best.country) return null;

  const { from: prevFrom, to: prevTo } = utcDayBounds(previousPeriod(range));
  const [prevRow] = await db
    .select({ count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        eq(trackingEvents.geoCountry, best.country),
        gte(trackingEvents.createdAt, prevFrom),
        lte(trackingEvents.createdAt, prevTo),
      ),
    );
  const previousCount = prevRow?.count ?? 0;
  const percentChange = previousCount > 0 ? ((best.count - previousCount) / previousCount) * 100 : null;
  return { country: best.country, count: best.count, percentChange };
}
```

- [ ] **Step 5: `getOrgBreakdowns` — device, country, referrer**

Generalizes `breakdownForLink`: filter by `organizationId` instead of `linkId`, and (unlike the
per-link version's `limit(5)`) return every row for country (the location table paginates
client-side) and device, but keep referrer's `null` rows instead of discarding them (mapped to a
literal `"Directo"` label — every other breakdown discards nulls, referrer is the one exception,
because "no referrer" is itself a meaningful, expected bucket here, not missing data):

```ts
async function orgBreakdown(
  organizationId: string,
  eventType: AnalyticsEventType,
  column: typeof trackingEvents.deviceType | typeof trackingEvents.geoCountry,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  const rows = await db
    .select({ label: column, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(column)
    .orderBy(desc(count()));
  return rows.filter((row) => row.label !== null).map((row) => ({ label: row.label as string, count: row.count }));
}

async function orgReferrerBreakdown(
  organizationId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  const rows = await db
    .select({ label: trackingEvents.referrer, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(trackingEvents.referrer)
    .orderBy(desc(count()));
  return rows.map((row) => ({ label: row.label ?? "Directo", count: row.count }));
}

export type OrgBreakdowns = { devices: BreakdownRow[]; countries: BreakdownRow[]; referrers: BreakdownRow[] };

export async function getOrgBreakdowns(
  organizationId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<OrgBreakdowns> {
  const [devices, countries, referrers] = await Promise.all([
    orgBreakdown(organizationId, eventType, trackingEvents.deviceType, from, to),
    orgBreakdown(organizationId, eventType, trackingEvents.geoCountry, from, to),
    orgReferrerBreakdown(organizationId, eventType, from, to),
  ]);
  return { devices, countries, referrers };
}
```

- [ ] **Step 6: Export everything from `index.ts`**

`getOrgTrendGrouped`, `getOrgTotals`, `getOrgBestDay`, `getOrgBestLocation`, `getOrgBreakdowns`,
`type OrgBreakdowns`.

- [ ] **Step 7: `org-service.test.ts`**

Focus on the pure logic, not full DB round-trips (no test DB harness exists in this repo today —
match the project's existing testing posture of unit-testing pure functions, not integration
testing queries): extract `percentChange` computation used identically in three places
(`getOrgTotals`/`getOrgBestDay`/`getOrgBestLocation` — `previous > 0 ? ((c - p) / p) * 100 : null`)
into one small exported pure helper (e.g. `percentChange(current: number, previous: number):
number | null`) used by all three, and unit-test *that*: positive change, negative change,
`previous === 0` → `null`, `current === previous` → `0`. Also test `daysBetween` (Task 3 Step 2)
directly: same-day range → `1`, a 7-day range → `7`.

- [ ] **Step 8: Typecheck and run the new tests**

Run: `pnpm typecheck && pnpm test -- org-service date-range`. Expected: both exit `0`.

- [ ] **Step 9: Do not commit.**

### Task 5: Data Route

**Files:**
- Create: `app/(protected)/analytics/data/route.ts`
- Test: `pnpm typecheck`

**Interfaces:**
- Consumes: every function from Task 4, `getAnalyticsSource` (existing, from `@/modules/analytics`).
- Produces: `GET /analytics/data?surface=qr|links&from=...&to=...&granularity=day|week|month` →
  `{ trend, totals, bestDay, bestLocation, breakdowns }`.

- [ ] **Step 1: Write the route**

Mirror `app/(protected)/analytics/[linkId]/data/route.ts`'s shape (auth check, zod-parsed query,
`utcDayBounds`), but scoped to `user.profile.organizationId` instead of a `linkId` path param, and
add `surface: z.enum(["qr", "links"])` to the query schema, converted once via
`getAnalyticsSource(parsed.data.surface).eventType`:

```ts
const querySchema = z.object({
  surface: z.enum(["qr", "links"]),
  granularity: z.enum(["day", "week", "month"]),
  from: z.string().date(),
  to: z.string().date(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const orgId = user.profile.organizationId;
  const eventType = getAnalyticsSource(parsed.data.surface).eventType;
  const range = { from: parsed.data.from, to: parsed.data.to };
  const { from, to } = utcDayBounds(range);
  const prevRange = previousPeriod(range);
  const { from: prevFrom, to: prevTo } = utcDayBounds(prevRange);

  const [trend, previousTrend, totals, bestDay, bestLocation, breakdowns] = await Promise.all([
    getOrgTrendGrouped(orgId, eventType, parsed.data.granularity, from, to),
    // Same granularity/span as `trend`, so both arrays line up index-for-index for the chart's
    // current-vs-previous overlay (Task 8 Step 4) without any date-alignment logic on the client.
    getOrgTrendGrouped(orgId, eventType, parsed.data.granularity, prevFrom, prevTo),
    getOrgTotals(orgId, eventType, range),
    getOrgBestDay(orgId, eventType, range),
    getOrgBestLocation(orgId, eventType, range),
    getOrgBreakdowns(orgId, eventType, from, to),
  ]);

  return NextResponse.json({ trend, previousTrend, totals, bestDay, bestLocation, ...breakdowns });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [ ] **Step 3: Do not commit.**

### Task 6: Install `@mapcn/map`

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `components.json` (if the shadcn CLI touches it)
- Test: `pnpm typecheck`

- [ ] **Step 1: Run the installer**

`pnpm dlx shadcn@latest add @mapcn/map`. Follow its prompts using this project's existing shadcn
config (same `components.json` every other shadcn component in this repo was added through).

- [ ] **Step 2: Read what it generated**

Before writing `org-map.tsx` in Task 8, open whatever file(s) the CLI dropped in (likely under
`src/components/ui/`) and note its actual prop shape — the design doc deliberately left this
unconfirmed until install. If it renders client-side only (likely, for an interactive map), confirm
it's already a `"use client"` component so `org-map.tsx` doesn't need to do anything special beyond
wrapping it.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`. Expected: `0` (nothing consumes it yet).

- [ ] **Step 4: Do not commit** (or commit alone if the user asks to snapshot the dependency add
      separately — installer commits are a judgment call, default to holding it with everything
      else per the Global Constraints).

### Task 7: Nav — Third Tab

**Files:**
- Modify: `app/(protected)/sidebar.tsx`
- Test: browser check (Task 9)

- [ ] **Step 1: Add the nav item**

Inside the existing `qrShortLinksOpen && (...)` block, after the "Códigos QR" `NavItem`, add a
third one pointing at `/analytics`:

```tsx
<NavItem href="/analytics" idle={ChartColumn} active={ChartColumnIncreasing}>
  Analytics
</NavItem>
```

Add `ChartColumn`, `ChartColumnIncreasing` to the existing icon import block (same source the
other idle/active icon pairs come from — check whether that's `lucide` or `lucide-react` in this
file today and match it exactly, don't introduce a second import source for icons in the same
file). Any reasonably distinct idle/active icon pair is fine — this is not a design decision worth
blocking on.

- [ ] **Step 2: Do not commit.**

### Task 8: Dashboard Page + Components

**Files:**
- Create: `app/(protected)/analytics/page.tsx`
- Create: `app/(protected)/analytics/org-dashboard.tsx`
- Create: `app/(protected)/analytics/org-trend-chart.tsx`
- Create: `app/(protected)/analytics/stat-card.tsx`
- Create: `app/(protected)/analytics/device-donut.tsx`
- Create: `app/(protected)/analytics/location-table.tsx`
- Create: `app/(protected)/analytics/referrer-list.tsx`
- Create: `app/(protected)/analytics/org-map.tsx`
- Test: `pnpm typecheck`, browser check (Task 9)

**Interfaces:**
- Consumes: `GET /analytics/data` (Task 5) from the client, `@mapcn/map`'s component (Task 6).

- [ ] **Step 1: `page.tsx` — thin server shell**

Auth check (`getCurrentUser`, redirect if absent — same pattern as every other page in
`app/(protected)`), then render `<OrgDashboard />` (no server-fetched props needed — the client
component owns its own date range / surface state and fetches from `/analytics/data` itself, same
posture as `EventAnalyticsPanel`).

- [ ] **Step 2: `org-dashboard.tsx` — client shell**

`"use client"`. Owns `surface: AnalyticsSurface` (`useState<"qr" | "links">("links")`, default to
Enlaces per no strong reason to default to the other), `range: DateRange`
(`@/components/ui/date-range-picker`, same `defaultRange()` pattern as
`event-analytics-panel.tsx` — last 30 days), fetches `/analytics/data` on either changing (same
`useEffect` + cancellation-flag pattern already used there), and lays out:

```tsx
<div className="flex flex-col gap-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h1 className="font-heading text-xl font-semibold">Analytics</h1>
    <div className="flex flex-wrap items-center gap-3">
      <Select value={surface} onValueChange={...}> {/* Enlaces / Códigos QR */} </Select>
      <DateRangePicker value={range} onChange={setRange} />
    </div>
  </div>

  {data && (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Mejor día por interacciones" .../>
        <StatCard label="Mejor ubicación por interacciones" .../>
      </div>
      <OrgTrendChart trend={data.trend} totals={data.totals} surface={surface} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DeviceDonut rows={data.devices} />
        <LocationTable rows={data.countries} />
      </div>
      <ReferrerList rows={data.referrers} />
      <OrgMap rows={data.countries} />
    </>
  )}
</div>
```

Source `Select` options use the app's shared `Select`/`SelectContent`/`SelectItem` primitives,
same as every other selector in this codebase.

- [ ] **Step 3: `stat-card.tsx`**

One reusable card taking `{ label: string; value: string; percentChange: number | null;
comparisonLabel: string }`, styled exactly like the existing `+1.9% vs mitad anterior` stat in
`event-analytics-panel.tsx` (`rounded-lg border border-border bg-card p-4`, green/red
`TrendingUp`/`TrendingDown` from `lucide-react`, `text-emerald-500`/`text-red-500`). Renders "Sin
datos en este rango." (existing empty-state copy) when the underlying best-day/best-location value
is `null`.

- [ ] **Step 4: `org-trend-chart.tsx`**

Same visual language as `event-analytics-panel.tsx`'s `LineChart` (import that file's `defs`
gradient/glow block, `CartesianGrid`, custom single-row `Tooltip` `content` function, dashed accent
cursor — copy the styling constants, this is a new component, not a shared one, per the design
doc's explicit call to keep `EventAnalyticsPanel` unchanged) but with **two** `<Line>` series
instead of one Line + a `ReferenceLine` average: `data.trend` (solid, `var(--accent)`, with the
glow filter) and `data.previousTrend` (dashed, `var(--muted-foreground)`, no glow) — both already
the same length and granularity from Task 5, overlaid by array index (day-offset-within-range, not
calendar date — the two periods have different calendar dates but the same span), matching the
reference screenshot's two overlapping lines. Merge the two arrays into one Recharts `data` prop
client-side (`trend.map((row, i) => ({ ...row, previousCount: previousTrend[i]?.count ?? 0 }))`) so
both `<Line dataKey="count">`/`<Line dataKey="previousCount">` read from one dataset, standard
Recharts multi-series pattern.

- [ ] **Step 5: `device-donut.tsx`**

Recharts `PieChart` + `Pie` + `Cell`, theme color tokens (`var(--accent)`, `var(--primary)`, and a
handful of additional token-driven colors cycling through the existing app palette — no new literal
hex values), legend as a simple list beside it (label + count), same card shell
(`rounded-lg border border-border bg-card p-4`). Empty state: "Sin datos en este rango."

- [ ] **Step 6: `location-table.tsx`**

Country + count + percent-of-total (computed client-side from the row list: `count / total * 100`)
+ flag (emoji derived from the stored ISO country code —
`String.fromCodePoint(...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0)))`, a
well-known zero-dependency trick for regional-indicator flag emoji). No trend column per row
(the design doc's "vs anterior" column requires a per-country previous-period count for every row,
not just the best one — that's meaningfully more query work for a column that's secondary to the
already-present "Mejor ubicación" trend stat; cut here, revisit only if asked). Sorted descending,
no server-side pagination (expected row count is small — every distinct country seen in range, not
every event).

- [ ] **Step 7: `referrer-list.tsx`**

Same list styling as the existing `BreakdownList` in `event-analytics-panel.tsx` (domain + count),
with `"Directo"` rendered as a muted/italic label to visually distinguish "no referrer" from a real
domain.

- [ ] **Step 8: `org-map.tsx`**

Wraps whatever `@mapcn/map` generated in Task 6, fed `data.countries.map(row => ({ countryCode:
row.label, count: row.count }))`. Exact prop wiring depends on Task 6 Step 2's findings — implement
against the real API once installed, not against this plan's guess.

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`. Expected: `0`.

- [ ] **Step 10: Do not commit.**

### Task 9: Browser Verification

**Files:** none

- [ ] **Step 1: `pnpm dev`, open `/analytics`**

Confirm the page loads, the source selector defaults to "Enlaces", and every widget renders (not
stuck in a loading state) for an org that has real tracking data (reuse the same test link/QR data
already present in the dev DB from prior sessions' verification work).

- [ ] **Step 2: Switch the source selector to "Códigos QR"**

Confirm every widget re-fetches and changes (not just the trend chart) — the "Mejor
día"/"Mejor ubicación" cards, donut, table, referrer list, and map should all reflect QR-scan data,
not a stale mix of both.

- [ ] **Step 3: Change the date range**

Confirm "período anterior" in the trend chart and the two stat cards' percentChange all update
consistently with the new range (spot-check the math on one card against the raw numbers shown).

- [ ] **Step 4: Confirm referrer capture end-to-end**

Trigger a redirect through `/r/<slug>` (or `/q/<code>`) using a request that carries a `Referer`
header — e.g. via `curl -e "https://example.com/test-referrer" http://localhost:3000/r/<slug>` —
then reload `/analytics` and confirm `example.com` appears in the referrer list. Also trigger one
with no `Referer` header and confirm it shows up under "Directo", not as a missing/blank row.

- [ ] **Step 5: Confirm the map renders**

Country circles/markers should appear scaled by count, matching the location table's numbers.

- [ ] **Step 6: Confirm empty states**

Pick a date range with no data (e.g. far in the future) and confirm every widget shows "Sin datos
en este rango." rather than an error, a blank area, or an infinite loading spinner.

- [ ] **Step 7: `pnpm build`**

Expected: exits `0`.

---

## Self-Review

### Spec Coverage

- New `/analytics` tab, nav wiring, coexistence with `/analytics/[linkId]`: Task 7, Task 8 Step 1.
- Source selector (never blends, switches which data feeds the shared layout): Task 8 Step 2.
- Shared date range + "período anterior", own page-scoped state: Task 8 Step 2.
- Trend chart (current vs previous overlaid): Task 4 Step 1, Task 5, Task 8 Step 4.
- "Mejor día"/"Mejor ubicación" cards with % vs previous: Task 4 Steps 3–4, Task 8 Step 3.
- Device donut, location table: Task 4 Step 5, Task 8 Steps 5–6.
- Referrer tracking (new scope) end-to-end (capture → storage → query → UI, "Directo" for null):
  Tasks 1, 2, 4 Step 5, Task 8 Step 7, verified in Task 9 Step 4.
- World map via `@mapcn/map`: Task 6, Task 8 Step 8.
- Explicit cuts from the design doc (combined-surface chart, retention backfill, org-level
  pre-aggregated rollup for breakdowns): none of the tasks above introduce them.

### Incomplete-Step Scan

- Task 6 Step 2 and Task 8 Step 8 are deliberately left open pending the real `@mapcn/map` API —
  called out explicitly in both places, not silently assumed.
- Task 8 Step 6 makes one explicit scope cut (no per-row trend column in the location table) with
  its reasoning stated inline, not left ambiguous.

### Type Consistency

- `AnalyticsEventType`/`AnalyticsSurface`/`getAnalyticsSource` are reused exactly as they exist
  today (Global Constraints) — no parallel "surface" type introduced.
- `percentChange`'s definition (`previous > 0 ? ((current - previous) / previous) * 100 : null`) is
  written out identically in `getOrgTotals`/`getOrgBestDay`/`getOrgBestLocation` in this plan, then
  explicitly factored into one shared helper in Task 4 Step 7 so the three call sites can't drift
  from each other during implementation.
- **Deliberately mixed date-param style, not an oversight**: `getOrgTotals`/`getOrgBestDay`/
  `getOrgBestLocation` take a string `AnalyticsDateRange` (they need `previousPeriod(range)`, which
  operates on that string type) while `getOrgTrendGrouped`/`getOrgBreakdowns` take `Date` bounds,
  matching their existing per-link siblings (`getAnalyticsForLinkGrouped`/
  `getAnalyticsBreakdownsForLink`) exactly, since neither needs previous-period math itself (the
  route computes the previous range once and calls `getOrgTrendGrouped` a second time for it,
  Task 5). Both styles already coexist in today's `service.ts` — this plan doesn't introduce a
  third convention, just applies each existing one where it already fits.
