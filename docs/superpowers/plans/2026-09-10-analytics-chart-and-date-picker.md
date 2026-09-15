# Analytics Chart and Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give QR scans and short-link clicks separate analytics charts with one reusable, accessible date-range control and inclusive selected-day boundaries.

**Architecture:** Keep the analytics event type server-owned by route: `/analytics/[linkId]` hard-codes `qr_scan`, while a new `/links/[id]/analytics` hard-codes `link_click`; neither endpoint accepts a source/metric query parameter. Extract the range-aware chart controls into a reusable client feature component, and use shadcn Base UI `Calendar` plus `Popover` as the shared `DateRangePicker` foundation. Normalize date-only HTTP parameters to UTC start/end-of-day in the analytics module before breakdown queries; rollup queries continue comparing their date keys.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5.9.3 strict, Tailwind CSS v4, pnpm 11.20.0, Vitest 5.0.0, Recharts 3.10.1, shadcn Base UI (`@base-ui/react` 1.8.0), `react-day-picker` 10.0.1, and `date-fns` 4.4.0.

## Global Constraints

- Do not create a root `components/ui` directory; shadcn UI primitives belong in `src/components/ui` because `components.json` maps `@/components/ui` there.
- Use `pnpm` exclusively; the implementation may add only `react-day-picker@10.0.1` and `date-fns@4.4.0`, which are currently absent, and must update `package.json` and `pnpm-lock.yaml` together.
- Reuse installed `recharts@3.10.1`, `@base-ui/react@1.8.0`, `cn@0.2.6`, the existing `Button`, and the existing `Select`; do not add another chart, popover, or date library.
- `app/(protected)/analytics/[linkId]` is QR analytics and may query/render only `qr_scan`; `/links/[id]/analytics` is Links analytics and may query/render only `link_click`.
- Never add a QR/Links metric selector, source-type URL parameter, or combined chart/CSV response.
- Both surfaces retain controlled date range selection, `day`/`week`/`month` granularity, CSV export, the current loading state, and truthful empty/no-rollup states.
- Convert selected date-only boundaries to `00:00:00.000Z` and `23:59:59.999Z`; both selected calendar days are included.
- Make the supplied calendar visual language the shared standard: semantic app tokens, dark-theme-compatible popover, bordered outline trigger, calendar navigation, visible selected range, and responsive one-month/two-month layout. Do not add one-off native date inputs or CSS date-picker styling to analytics surfaces.
- Reconcile, rather than overwrite, active user changes in `app/(protected)/analytics/[linkId]/scans-panel.tsx`, `page.tsx`, `activity-heatmap.tsx`, `app/globals.css`, `src/components/ui/select.tsx`, `src/components/binary-loader.tsx`, and `src/components/tooltip.tsx`.
- Preserve the currently added `BinaryLoader` loading state, Base UI `Select` granularity control, tooltip changes, and existing theme CSS unless a reviewed conflict requires a targeted merge.
- Do not stage, commit, reset, revert, or reformat unrelated work. This plan deliberately contains no commit step because authorization was not granted.

---

## Current-State Map

- `app/(protected)/analytics/[linkId]/scans-panel.tsx` currently owns the QR date inputs, `ScanGranularity`, client fetch, Recharts bar, `BinaryLoader` loading state, and QR-specific breakdowns.
- `app/(protected)/analytics/[linkId]/data/route.ts` validates `granularity`, `from`, and `to`, and already expands `to` to the final UTC millisecond. It must become an explicit QR-only adapter over shared analytics services.
- `src/modules/analytics/service.ts` currently hard-codes `qr_scan` in breakdown queries but exposes a rollup query and CSV export that combine click and scan columns. This is the source of the existing Links-page ambiguity.
- `app/(protected)/links/[id]/analytics-link.tsx` currently links a normal Link to the QR URL. It must link to the new Links-only route.
- `package.json` has Vitest scripts but no DOM/browser test setup. Existing tests are Node-level Vitest tests, so cover pure analytics range/source/CSV behavior there and perform keyboard/visual checks manually.

## File Structure

- Create: `src/modules/analytics/date-range.ts` — canonical date-only parsing and inclusive UTC bounds.
- Create: `src/modules/analytics/date-range.test.ts` — unit coverage for date parsing and boundary inclusivity.
- Create: `src/modules/analytics/source.ts` — closed, server-owned mapping from analytics surface to event type, rollup field, label, and CSV header.
- Create: `src/modules/analytics/source.test.ts` — unit coverage proving QR and Links map to non-overlapping event types and metrics.
- Modify: `src/modules/analytics/service.ts` — generic source-scoped rollup, breakdown, and CSV services; retain QR-specific count functions used by the QR header and heatmap.
- Modify: `src/modules/analytics/index.ts` — expose only the new source-scoped public APIs and types needed by route handlers.
- Modify: `src/modules/analytics/csv.ts` and `src/modules/analytics/csv.test.ts` — replace mixed-metric CSV formatting with one-metric-per-export formatting and tests.
- Modify: `package.json`, `pnpm-lock.yaml` — add only the confirmed missing calendar dependencies.
- Create: `src/components/ui/calendar.tsx` and `src/components/ui/popover.tsx` — generated shadcn Base UI primitives at the configured alias destination.
- Create: `src/components/ui/date-range-picker.tsx` — shared, controlled visual date-range picker built from those primitives.
- Create: `src/components/analytics/event-analytics-panel.tsx` — reusable client chart/control surface; it never chooses or sends an event type.
- Modify: `app/(protected)/analytics/[linkId]/scans-panel.tsx` and `app/(protected)/analytics/[linkId]/data/route.ts` — retain the QR route and existing states while wiring QR-only data through the shared panel/services.
- Modify: `app/(protected)/analytics/[linkId]/csv/route.ts` — make QR export use its selected range and QR-only CSV service.
- Create: `app/(protected)/links/[id]/analytics/page.tsx`, `data/route.ts`, and `csv/route.ts` — authorized Links-only page and hard-coded `link_click` handlers.
- Modify: `app/(protected)/links/[id]/analytics-link.tsx` — point the Link detail action to its Links-only analytics surface.

### Task 1: Establish Source and Date Contracts

**Files:**
- Create: `src/modules/analytics/date-range.ts`
- Create: `src/modules/analytics/date-range.test.ts`
- Create: `src/modules/analytics/source.ts`
- Create: `src/modules/analytics/source.test.ts`
- Modify: `src/modules/analytics/index.ts:2-24`

**Interfaces:**
- Produces: `type AnalyticsSurface = "qr" | "links"`.
- Produces: `type AnalyticsEventType = "qr_scan" | "link_click"`.
- Produces: `type AnalyticsMetric = "scans" | "clicks"`.
- Produces: `getAnalyticsSource(surface: AnalyticsSurface): { eventType: AnalyticsEventType; metric: AnalyticsMetric; singularLabel: string; pluralLabel: string; csvColumn: string }`.
- Produces: `utcDayBounds(range: { from: string; to: string }): { from: Date; to: Date }`.
- Consumed by: source-scoped services and the two route-handler families in later tasks.

- [ ] **Step 1: Write the failing source-mapping test**

```ts
import { describe, expect, it } from "vitest";
import { getAnalyticsSource } from "./source";

describe("getAnalyticsSource", () => {
  it("keeps QR scans and link clicks in non-overlapping source contracts", () => {
    expect(getAnalyticsSource("qr")).toMatchObject({
      eventType: "qr_scan",
      metric: "scans",
      csvColumn: "scans_human",
    });
    expect(getAnalyticsSource("links")).toMatchObject({
      eventType: "link_click",
      metric: "clicks",
      csvColumn: "clicks_human",
    });
  });
});
```

- [ ] **Step 2: Run the source-mapping test and verify it fails because `./source` does not exist**

Run: `pnpm test -- src/modules/analytics/source.test.ts`

Expected: FAIL with a module-resolution error for `./source`.

- [ ] **Step 3: Implement the closed source mapping**

```ts
export type AnalyticsSurface = "qr" | "links";
export type AnalyticsEventType = "qr_scan" | "link_click";
export type AnalyticsMetric = "scans" | "clicks";

type AnalyticsSource = {
  eventType: AnalyticsEventType;
  metric: AnalyticsMetric;
  singularLabel: string;
  pluralLabel: string;
  csvColumn: string;
};

const ANALYTICS_SOURCES: Record<AnalyticsSurface, AnalyticsSource> = {
  qr: {
    eventType: "qr_scan",
    metric: "scans",
    singularLabel: "escaneo",
    pluralLabel: "Escaneos",
    csvColumn: "scans_human",
  },
  links: {
    eventType: "link_click",
    metric: "clicks",
    singularLabel: "clic",
    pluralLabel: "Clics",
    csvColumn: "clicks_human",
  },
};

export function getAnalyticsSource(surface: AnalyticsSurface): AnalyticsSource {
  return ANALYTICS_SOURCES[surface];
}
```

- [ ] **Step 4: Write the failing inclusive-date test**

```ts
import { describe, expect, it } from "vitest";
import { utcDayBounds } from "./date-range";

describe("utcDayBounds", () => {
  it("includes both selected calendar days", () => {
    const range = utcDayBounds({ from: "2026-09-01", to: "2026-09-30" });

    expect(range.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });
});
```

- [ ] **Step 5: Run the date test and verify it fails because `./date-range` does not exist**

Run: `pnpm test -- src/modules/analytics/date-range.test.ts`

Expected: FAIL with a module-resolution error for `./date-range`.

- [ ] **Step 6: Implement the canonical UTC boundary helper**

```ts
export type AnalyticsDateRange = { from: string; to: string };

export function utcDayBounds({ from, to }: AnalyticsDateRange): { from: Date; to: Date } {
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  };
}
```

- [ ] **Step 7: Export the public contracts from the analytics module boundary**

```ts
export {
  getAnalyticsSource,
  type AnalyticsEventType,
  type AnalyticsMetric,
  type AnalyticsSurface,
} from "./source";
export { utcDayBounds, type AnalyticsDateRange } from "./date-range";
```

Add these exports alongside the existing `service` exports in `src/modules/analytics/index.ts`; do not import internal files from application routes.

- [ ] **Step 8: Run both focused tests**

Run: `pnpm test -- src/modules/analytics/source.test.ts src/modules/analytics/date-range.test.ts`

Expected: both files PASS; the test runner reports two passing tests.

### Task 2: Make Rollup Queries and CSV Exports Source-Scoped

**Files:**
- Modify: `src/modules/analytics/service.ts:178-278`
- Modify: `src/modules/analytics/csv.ts:1-16`
- Modify: `src/modules/analytics/csv.test.ts:1-30`
- Modify: `src/modules/analytics/index.ts:2-24`

**Interfaces:**
- Consumes: `AnalyticsEventType`, `AnalyticsMetric`, and `AnalyticsDateRange` from Task 1.
- Produces: `type AnalyticsGranularity = "day" | "week" | "month"` and `type AnalyticsBucket = { bucket: string; count: number }`.
- Produces: `getAnalyticsForLinkGrouped(linkId, eventType, granularity, from, to): Promise<AnalyticsBucket[]>`.
- Produces: `getAnalyticsBreakdownsForLink(linkId, eventType, from, to): Promise<{ devices: BreakdownRow[]; countries: BreakdownRow[]; cities: BreakdownRow[] }>`.
- Produces: `exportAnalyticsCsvForLink(linkId, eventType, range): Promise<string>`.
- Consumed by: QR and Links route handlers in Tasks 4 and 5.

- [ ] **Step 1: Replace the mixed-metric CSV tests with source-specific expectations**

```ts
import { describe, expect, it } from "vitest";
import { formatAnalyticsCsv } from "./csv";

describe("formatAnalyticsCsv", () => {
  it("exports QR data without link-click columns", () => {
    expect(
      formatAnalyticsCsv("scans_human", [{ bucket: "2026-09-01", count: 5 }]),
    ).toBe("date,scans_human\\n2026-09-01,5\\n");
  });

  it("exports Link data without QR-scan columns", () => {
    expect(
      formatAnalyticsCsv("clicks_human", [{ bucket: "2026-09-01", count: 10 }]),
    ).toBe("date,clicks_human\\n2026-09-01,10\\n");
  });
});
```

- [ ] **Step 2: Run the CSV test and verify it fails against the removed mixed-row interface**

Run: `pnpm test -- src/modules/analytics/csv.test.ts`

Expected: FAIL because `formatAnalyticsCsv` is not exported yet.

- [ ] **Step 3: Implement a one-metric CSV formatter**

```ts
export type AnalyticsCsvRow = { bucket: string; count: number };

export function formatAnalyticsCsv(
  column: "scans_human" | "clicks_human",
  rows: AnalyticsCsvRow[],
): string {
  return [`date,${column}`, ...rows.map((row) => `${row.bucket},${row.count}`)].join("\n") + "\n";
}
```

- [ ] **Step 4: Replace the source-implicit service APIs with source-explicit internal arguments**

Use a local `humanRollupColumn(eventType)` helper that returns `trackingRollupDaily.scansHuman` only for `"qr_scan"` and `trackingRollupDaily.clicksHuman` only for `"link_click"`. Reuse that column in daily and grouped queries. Use the exact public signatures below, and pass `eventType` into all breakdown predicates instead of the current hard-coded `qr_scan` predicate.

```ts
export type AnalyticsGranularity = "day" | "week" | "month";
export type AnalyticsBucket = { bucket: string; count: number };

export async function getAnalyticsForLinkGrouped(
  linkId: string,
  eventType: AnalyticsEventType,
  granularity: AnalyticsGranularity,
  from: Date,
  to: Date,
): Promise<AnalyticsBucket[]>;

export async function getAnalyticsBreakdownsForLink(
  linkId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<{ devices: BreakdownRow[]; countries: BreakdownRow[]; cities: BreakdownRow[] }>;

export async function exportAnalyticsCsvForLink(
  linkId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<string>;
```

For `exportAnalyticsCsvForLink`, call `utcDayBounds(range)`, request `"day"` buckets, obtain `csvColumn` from `getAnalyticsSource(eventType === "qr_scan" ? "qr" : "links")`, then call `formatAnalyticsCsv`. This makes an exported range and its event type exactly match the chart request.

- [ ] **Step 5: Keep only required QR-specific APIs and update public exports**

Retain `countQrScansForLink`, `countUniqueQrScansForLink`, and the QR heatmap's source-scoped grouped request. Remove public use of `getScansForLinkGrouped`, `getDeviceBreakdownForLink`, `getCountryBreakdownForLink`, `getCityBreakdownForLink`, and `exportRollupCsvForLink` after all consumers migrate. Export `AnalyticsGranularity`, `AnalyticsBucket`, `getAnalyticsForLinkGrouped`, `getAnalyticsBreakdownsForLink`, and `exportAnalyticsCsvForLink` from `src/modules/analytics/index.ts`.

- [ ] **Step 6: Run focused analytics tests**

Run: `pnpm test -- src/modules/analytics/csv.test.ts src/modules/analytics/source.test.ts src/modules/analytics/date-range.test.ts`

Expected: PASS; CSV headers contain exactly one metric column per surface and no test references the old five-column header.

### Task 3: Install and Standardize the Shared Calendar Controls

**Files:**
- Modify: `package.json:21-45`
- Modify: `pnpm-lock.yaml`
- Create: `src/components/ui/calendar.tsx`
- Create: `src/components/ui/popover.tsx`
- Create: `src/components/ui/date-range-picker.tsx`

**Interfaces:**
- Consumes: existing `Button` from `@/components/ui/button`, configured Base UI primitives, `cn`, `date-fns`, and React Day Picker `DateRange`.
- Produces: `DateRangePicker({ value, onChange, className }: { value: DateRange; onChange(value: DateRange): void; className?: string }): JSX.Element`.
- Consumed by: the shared chart panel in Task 4.

- [ ] **Step 1: Verify the planned primitive additions without editing files**

Run: `pnpm exec shadcn add calendar popover --dry-run`

Expected: reports creation of `src/components/ui/calendar.tsx` and `src/components/ui/popover.tsx`, skips the already-installed `button`, and lists `react-day-picker` plus `date-fns` as dependencies.

- [ ] **Step 2: Add only the two confirmed missing runtime dependencies**

Run: `pnpm add react-day-picker@10.0.1 date-fns@4.4.0`

Expected: `package.json` lists both packages under `dependencies`; `pnpm-lock.yaml` changes; no other dependency is added or upgraded.

- [ ] **Step 3: Generate the repository-compatible Base UI primitives at the configured alias path**

Run: `pnpm dlx shadcn@latest add calendar popover`

Expected: creates only `src/components/ui/calendar.tsx` and `src/components/ui/popover.tsx`; it does not create `/components/ui` and does not overwrite `src/components/ui/button.tsx`.

- [ ] **Step 4: Review the generated primitives before composing them**

Run: `pnpm exec shadcn add calendar popover --dry-run; if ($?) { pnpm typecheck }`

Expected: dry-run reports the primitives as present and type checking passes. Confirm the calendar imports `react-day-picker`, uses the project `Button`, and the popover imports `@base-ui/react/popover` with Base UI's `render` trigger API.

- [ ] **Step 5: Implement the shared controlled range picker**

```tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DateRangePickerProps = {
  value: DateRange;
  onChange(value: DateRange): void;
  className?: string;
};

function rangeLabel(value: DateRange): string {
  if (!value.from || !value.to) return "Seleccionar fechas";
  return `${format(value.from, "dd MMM yyyy")} - ${format(value.to, "dd MMM yyyy")}`;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [draft, setDraft] = useState<DateRange>(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className={cn("justify-start font-normal", className)}>
            <CalendarIcon data-icon="inline-start" />
            {rangeLabel(value)}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={draft}
          onSelect={(next) => {
            setDraft(next ?? {});
            if (next?.from && next.to) onChange({ from: next.from, to: next.to });
          }}
          numberOfMonths={2}
          className="[--cell-size:--spacing(9)] max-sm:[--cell-size:--spacing(8)] max-sm:[&_.rdp-months]:flex-col"
        />
      </PopoverContent>
    </Popover>
  );
}
```

Keep the generated primitive's semantic token styling. Do not add `dark:` overrides, manually-managed overlay z-index, native `<input type="date">`, or a second calendar implementation.

- [ ] **Step 6: Type-check the new client controls**

Run: `pnpm typecheck`

Expected: PASS with no implicit `any`, no React Day Picker type incompatibility, and no missing Base UI popover exports.

### Task 4: Extract a Shared Analytics Chart Panel and Preserve QR Behavior

**Files:**
- Create: `src/components/analytics/event-analytics-panel.tsx`
- Modify: `app/(protected)/analytics/[linkId]/scans-panel.tsx:1-168`
- Modify: `app/(protected)/analytics/[linkId]/data/route.ts:1-54`
- Modify: `app/(protected)/analytics/[linkId]/csv/route.ts:1-28`
- Modify: `app/(protected)/analytics/[linkId]/page.tsx:5-53`

**Interfaces:**
- Consumes: `DateRangePicker`, `AnalyticsGranularity`, `AnalyticsBucket`, `BreakdownRow`, and the existing `BinaryLoader`, `Select`, Recharts, and `HoverMorphIcon`.
- Produces: `EventAnalyticsPanel({ linkId, heading, surface, dataUrl, csvUrl, emptyMessage, showBreakdowns }: EventAnalyticsPanelProps): JSX.Element`.
- Produces: QR data handler that invokes `getAnalyticsForLinkGrouped(linkId, "qr_scan", ...)` and `getAnalyticsBreakdownsForLink(linkId, "qr_scan", ...)` only.
- Produces: QR CSV handler that invokes `exportAnalyticsCsvForLink(linkId, "qr_scan", range)` only.
- Consumed by: the Links page in Task 5.

- [ ] **Step 1: Reconcile the QR working-tree changes before editing**

Run: `git diff -- "app/(protected)/analytics/[linkId]/scans-panel.tsx" "app/(protected)/analytics/[linkId]/page.tsx" "app/(protected)/analytics/[linkId]/activity-heatmap.tsx" "app/globals.css"`

Expected: identifies the user-owned `BinaryLoader`, Base UI `Select`, tooltip, heatmap, and CSS work. Preserve all of it; restrict this task's edits to replacing native date inputs and source-scoping the data/CSV handlers.

- [ ] **Step 2: Implement the reusable client panel with source-free URLs**

Use this interface and keep `surface` only for Spanish labels and Recharts `dataKey`; never serialize it into `URLSearchParams`.

```ts
type EventAnalyticsPanelProps = {
  linkId: string;
  heading: string;
  surface: "qr" | "links";
  dataUrl: string;
  csvUrl: string;
  emptyMessage: string;
  showBreakdowns: boolean;
};

type PanelData = {
  buckets: Array<{ bucket: string; count: number }>;
  devices?: BreakdownRow[];
  countries?: BreakdownRow[];
  cities?: BreakdownRow[];
};
```

Initialize a 30-day `DateRange` once. Convert its local calendar dates with `format(date, "yyyy-MM-dd")` when constructing `URLSearchParams({ granularity, from, to })`. Build the CSV URL with the same `from` and `to` parameters. Retain `data === undefined` with `BinaryLoader`, retain the current chart card and tooltip tokens, retain the controlled Base UI granularity `Select`, and render the existing QR breakdown cards only when `showBreakdowns` is true. Map QR labels to `Escaneos` and Links labels to `Clics` using the closed `surface` prop.

- [ ] **Step 3: Convert `ScansPanel` into a minimal QR wrapper without erasing its current behavior**

```tsx
import { EventAnalyticsPanel } from "@/components/analytics/event-analytics-panel";

export function ScansPanel({ linkId }: { linkId: string }) {
  return (
    <EventAnalyticsPanel
      linkId={linkId}
      heading="Escaneos"
      surface="qr"
      dataUrl={`/analytics/${linkId}/data`}
      csvUrl={`/analytics/${linkId}/csv`}
      emptyMessage="Aún no hay escaneos en este rango."
      showBreakdowns
    />
  );
}
```

Do not change the QR page's `countQrScansForLink`, unique-count, or heatmap behavior. Update the heatmap call to `getAnalyticsForLinkGrouped(linkId, "qr_scan", "day", heatmapFrom, today)` and map `row.count` into `heatmapCounts`.

- [ ] **Step 4: Make the QR route handlers hard-code `qr_scan` and normalize bounds once**

```ts
const range = { from: parsed.data.from, to: parsed.data.to };
const { from, to } = utcDayBounds(range);
const [buckets, breakdowns] = await Promise.all([
  getAnalyticsForLinkGrouped(linkId, "qr_scan", parsed.data.granularity, from, to),
  getAnalyticsBreakdownsForLink(linkId, "qr_scan", from, to),
]);

return NextResponse.json({ buckets, ...breakdowns });
```

In the QR CSV handler, validate `from`/`to` as required `z.string().date()` parameters using the same schema shape, then call `exportAnalyticsCsvForLink(linkId, "qr_scan", range)`. Preserve the existing authentication, ownership, `401`, `404`, and download headers; rename the file to `qr-analytics-${linkId}.csv` to avoid confusing it with the Links export.

- [ ] **Step 5: Run focused correctness checks**

Run: `pnpm test -- src/modules/analytics; if ($?) { pnpm typecheck }`

Expected: analytics tests PASS and TypeScript accepts the QR-only handler/public-module imports.

### Task 5: Add the Separate Links Analytics Surface

**Files:**
- Create: `app/(protected)/links/[id]/analytics/page.tsx`
- Create: `app/(protected)/links/[id]/analytics/data/route.ts`
- Create: `app/(protected)/links/[id]/analytics/csv/route.ts`
- Modify: `app/(protected)/links/[id]/analytics-link.tsx:1-15`

**Interfaces:**
- Consumes: `EventAnalyticsPanel` from Task 4 and `getAnalyticsForLinkGrouped`, `exportAnalyticsCsvForLink`, `utcDayBounds` from the analytics public boundary.
- Produces: a Links-only page at `/links/[id]/analytics`, a `link_click`-only JSON data endpoint, and a `link_click`-only CSV endpoint.
- Produces: `AnalyticsLink` with `href={`/links/${linkId}/analytics`}`.

- [ ] **Step 1: Create the Links analytics page with ownership checks and a click-only panel**

```tsx
import { notFound } from "next/navigation";
import { EventAnalyticsPanel } from "@/components/analytics/event-analytics-panel";
import { getCurrentUser } from "@/modules/auth";
import { getLink } from "@/modules/links";

export default async function LinkAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const link = await getLink(id);
  if (!link || link.organizationId !== user.profile.organizationId) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-xs text-muted-foreground uppercase">Enlace</p>
        <h1 className="mt-2 truncate font-mono text-lg font-semibold">{link.destinationUrl}</h1>
      </div>
      <EventAnalyticsPanel
        linkId={id}
        heading="Clics"
        surface="links"
        dataUrl={`/links/${id}/analytics/data`}
        csvUrl={`/links/${id}/analytics/csv`}
        emptyMessage="Aún no hay clics en este rango."
        showBreakdowns={false}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the Links data handler with a closed event type**

Use the same auth, ownership, Zod date/granularity validation, and `utcDayBounds` flow as the QR handler, but use this exact source argument:

```ts
const { from, to } = utcDayBounds(parsed.data);
const buckets = await getAnalyticsForLinkGrouped(
  linkId,
  "link_click",
  parsed.data.granularity,
  from,
  to,
);

return NextResponse.json({ buckets });
```

Do not accept `sourceType` in the query schema and do not return QR breakdowns or scan counts from this route.

- [ ] **Step 3: Create the Links CSV handler with the same selected range**

Validate required `from` and `to` query parameters, retain the route's auth and ownership checks, then use:

```ts
const csv = await exportAnalyticsCsvForLink(linkId, "link_click", parsed.data);
```

Return `Content-Type: text/csv` and `Content-Disposition: attachment; filename="link-analytics-${linkId}.csv"`. No QR column may appear in the response.

- [ ] **Step 4: Redirect the Link detail action to the Links-only surface**

```tsx
<Link
  href={`/links/${linkId}/analytics`}
  className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
>
  <HoverMorphIcon idle={ChartLine} active={ArrowUpRight} />
  Ver analíticas
</Link>
```

- [ ] **Step 5: Run static verification for source separation**

Run: `rg -n '"qr_scan"|"link_click"' "app/(protected)/analytics" "app/(protected)/links/[id]/analytics"; if ($?) { pnpm typecheck }`

Expected: QR handlers show only `"qr_scan"`; Links handlers show only `"link_click"`; no handler parses a `sourceType` request parameter; TypeScript passes.

### Task 6: Full Verification and Manual Accessibility Review

**Files:**
- Verify: all files listed in Tasks 1-5

**Interfaces:**
- Verifies: source separation, inclusive bounds, shared control reuse, no mixed CSV, preserved loading/empty behavior, strict types, lint, unit suite, and production build.

- [ ] **Step 1: Run the supported automated suite**

Run: `pnpm check`

Expected: `eslint .`, `tsc --noEmit`, `vitest run --passWithNoTests`, and `next build` all exit `0`. The Vitest summary includes the original tests plus the new source/date/CSV tests.

- [ ] **Step 2: Inspect the diff for scope and source leaks**

Run: `git diff --check; if ($?) { rg -n 'sourceType' "app/(protected)/analytics/[linkId]" "app/(protected)/links/[id]/analytics" }; if ($?) { git status --short }`

Expected: no whitespace errors; neither UI endpoint exposes a source selector/query parameter; only authorized implementation files, dependency files, and the pre-existing user changes are present. Do not stage anything.

- [ ] **Step 3: Perform the QR manual acceptance pass**

Run: `pnpm dev`

Expected: open `/analytics/<known-link-id>` while authenticated. The trigger opens the shared dark-theme calendar; Tab/Shift+Tab and arrow keys operate the control and visible focus is present; selecting `2026-09-01` through `2026-09-30` refetches QR-only bars; the request is `/analytics/<id>/data?granularity=day&from=2026-09-01&to=2026-09-30`; CSV carries the same range and has only `date,scans_human`; the existing `BinaryLoader` appears while loading and the existing empty message appears when no QR rollups match.

- [ ] **Step 4: Perform the Links manual acceptance pass**

Run: `pnpm dev`

Expected: open `/links/<known-link-id>`, select `Ver analíticas`, and confirm the destination is `/links/<id>/analytics`. Verify the same keyboard-accessible shared calendar, granularity selector, and range-preserving CSV behavior. The data request is `/links/<id>/analytics/data?granularity=day&from=2026-09-01&to=2026-09-30`; bars and CSV contain only clicks; the empty message says there are no clicks, not scans.

- [ ] **Step 5: Prove inclusive boundary behavior with seeded/manual known events**

Use one `qr_scan` and one `link_click` whose timestamps fall on the selected first and last dates, plus one event of each type in the range. Query each surface for the same dates.

Expected: QR count includes only its two QR events and Links count includes only its two click events; an event at `2026-09-30T23:59:59.999Z` remains included; opposite-source events never appear on the other chart or CSV.

## Self-Review

### Spec Coverage

- Shared `Calendar` and `DateRangePicker` under `src/components/ui`: Task 3.
- Correct shadcn alias and no root UI directory: Global Constraints and Task 3.
- QR `qr_scan` only: Tasks 1, 2, and 4.
- Links `link_click` only: Tasks 1, 2, and 5.
- No combined selector/metrics: Global Constraints, closed server mapping, and Task 5 source-free schema.
- Preserved date range, granularity, CSV, loading, and empty states: Tasks 3-5 and manual acceptance steps.
- Inclusive start/end selected days: Task 1 helper, Task 2 service export, and Task 6 boundary proof.
- Dependency additions deferred until confirmed: confirmed here by `pnpm why`/shadcn dry-run; Task 3 adds only `react-day-picker@10.0.1` and `date-fns@4.4.0`.
- Existing dirty work protected: Global Constraints and Task 4 reconciliation gate.

### Placeholder Scan

- No unfilled action markers, deferred implementation notes, or unspecified test steps remain.
- Every implementation task has exact paths, public interfaces, code/commands, and expected results.
- No commit command appears because staging and commits are explicitly unauthorized.

### Type Consistency

- `AnalyticsSurface` is only `"qr" | "links"`; `AnalyticsEventType` is only `"qr_scan" | "link_click"`.
- `AnalyticsGranularity` is consistently `"day" | "week" | "month"`.
- Both route families pass date strings into `utcDayBounds` and pass `Date` values into grouped/breakdown services.
- `EventAnalyticsPanel` owns UI surface labels and URLs, while source type remains an unforgeable server literal in each route handler.

### Risks

- The current worktree is dirty in the QR panel, page, heatmap, global CSS, and UI helpers. The implementation must merge those current changes, not replace files from a stale plan snapshot.
- There is no jsdom, Testing Library, Playwright config, or browser test suite. Unit coverage can prove contracts and boundary conversion, but visual/keyboard interaction requires the manual checks listed in Task 6 unless a separate test-infrastructure change is authorized.
- Analytics rollups intentionally exclude the accumulating current day in `runDailyRollup`; selecting today can honestly show no rollup even when raw events exist. Preserve the existing truthful empty state rather than fabricating a zero/real-time result.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-analytics-chart-and-date-picker.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, and iterate quickly.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`, with checkpoints for review.
