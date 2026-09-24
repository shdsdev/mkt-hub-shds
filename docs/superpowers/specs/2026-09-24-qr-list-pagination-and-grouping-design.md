# QR List: Server-Side Pagination, N+1 Fix, and Folder/Campaign Filtering

## Context

`app/(protected)/qr/page.tsx` fetches every QR code for the organization unconditionally
(`listQrCodes(orgId)`, no `limit`/`offset`) and, for each row, calls `countEventsForQrCode(qr.id)`
to get its scan count. That function does two DB round-trips per call — `getQrCode(qrCodeId)`
(redundant: the caller already has the row) plus the count query itself — so every page load costs
`2 × (number of QR codes)` queries. All filtering (status, type) and the search box are client-side
over the full fetched array. None of this scales as the organization creates more QR codes.

Separately, the user tried a floating "CONTENTS" folder/campaign tree overlapping the sidebar and
main content; it didn't read as anchored to anything and is being replaced.

## Scope

**In**: server-side pagination (20/page default) and filtering (status, type, folder, campaign,
search) on the QR list; a single batched query for scan counts instead of the N+1; a horizontal
All/Carpetas/Campañas tab bar with a conditional folder/campaign `Select`; a pagination control;
two new shared components (`Tabs`, `Pagination`) adapted from the user-supplied references onto
this project's own primitives (base-ui + `lucide`) and color tokens, not the references' Radix
wrapper package or hardcoded `zinc-*`/`neutral-*` colors.

**Out**: changing the grid/list view toggle, changing what a QR "card" or "row" displays, bulk
actions, virtualization, any change to `/qr/bulk` (the batch-import wizard), reworking folders or
campaigns themselves (creation/deletion UI already exists elsewhere).

## Data Layer

### Batched scan counts

New function in `src/modules/analytics/service.ts`:

```ts
export async function countEventsForQrCodes(
  qrCodes: { id: string; linkId: string | null }[],
): Promise<Map<string, number>> {
  const linkIds = qrCodes.map((qr) => qr.linkId).filter((id): id is string => id !== null);
  const counts =
    linkIds.length === 0
      ? []
      : await db
          .select({ linkId: trackingEvents.linkId, count: count() })
          .from(trackingEvents)
          .where(and(inArray(trackingEvents.linkId, linkIds), eq(trackingEvents.sourceType, "qr_scan")))
          .groupBy(trackingEvents.linkId);
  const countsByLinkId = new Map(counts.map((row) => [row.linkId, row.count]));
  return new Map(qrCodes.map((qr) => [qr.id, qr.linkId ? (countsByLinkId.get(qr.linkId) ?? 0) : 0]));
}
```

`trackingEvents` does have a `qr_code_id` column (`src/modules/analytics/db.ts`), but it is never
populated on the write path: `handleRedirect` (`src/modules/redirects/http.ts`) calls `trackRedirect`
with only `linkId`/`shortLinkId`, never `qrCodeId` — the redirect resolver only knows the link and
short link it matched, not which QR code (if any) encodes that short URL (see the existing comment
at `src/modules/analytics/service.ts:80-81`). So this new function keys off `linkId`, exactly like
the existing single-QR `countEventsForQrCode` does — it batches the *same* query shape across many
QR codes instead of running it once per row. Static QR codes (`linkId === null`) map to `0` without
a query. The signature takes `{ id, linkId }` pairs (not bare ids) so it needs no extra DB round-trip
to look up each QR's `linkId` — the caller already has full `QrCodeRow`s in hand from `listQrCodes`.

`countEventsForQrCode` (singular) stays for any other single-QR caller; it is not removed.

### Paginated, filtered `listQrCodes`

Replace the no-args `listQrCodes(organizationId)` with:

```ts
export type QrCodeListFilter = {
  status?: "active" | "archived" | "disabled";
  mode?: "dynamic" | "static";
  folderId?: string;
  campaignId?: string;
  search?: string;
  page: number;      // 1-indexed
  pageSize: number;   // 20 default, set by the caller
};

export async function listQrCodes(
  organizationId: string,
  filter: QrCodeListFilter,
): Promise<{ rows: QrCodeRow[]; total: number }>;
```

- `status`/`mode`/`folderId`/`campaignId` are plain `eq()` filters on `qrCodes` columns already
  present on the table (see `src/modules/qr/db.ts`).
- `search` matches (case-insensitive `ilike`, mirroring the current client-side `matchesSearch`):
  `qrCodes.name`, `qrCodes.staticPayload`, the joined `links.destinationUrl` (dynamic QRs only), and
  the joined `shortLinks.slug`. This is a narrower match than today's client-side version, which
  also matches the *full* short URL string (`https://domain/q/slug`) — matching the bare slug
  instead of the assembled URL is the one intentional, disclosed behavior change; searching a full
  pasted short URL will no longer match by the `https://`/domain prefix, only by its slug tail.
- Returns `{ rows, total }` — `total` is a second `count()` query with the same `WHERE` (no
  `limit`/`offset`), needed to render "página X de Y" and disable next/prev at the edges.
- All existing callers of the old no-args `listQrCodes` (just `app/(protected)/qr/page.tsx`) are
  updated in the same change; there are no other callers (checked via `Grep`).

### Route: reading filter/page state

`app/(protected)/qr/page.tsx` becomes `async function QrPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })`,
parses `page`, `status`, `mode`, `folder`, `campaign`, `q` (search) via a small `zod` schema
(defaults: `page=1`, everything else unset/"all"), and passes the parsed filter into `listQrCodes`.
Folders/campaigns/utmPresets/templates/domains/links/shortLinks are still fetched in full (they're
small, org-wide reference lists, not paginated) — only the QR codes themselves are paginated.

## UI

### Tabs + conditional Select

`QrList` (client component) keeps owning view-mode (grid/list) and the existing status/mode
`Select`s as local UI state, but **filter state that affects the DB query now lives in the URL**,
not component state — changing a tab, select, or the search box calls `router.push` with updated
search params (via `useRouter`/`usePathname`/`useSearchParams`), so the page re-fetches server-side
and the URL stays bookmarkable/shareable, matching the rest of the app's Server Component-first
pattern.

- New `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` in `src/components/ui/tabs.tsx`, built on
  `@base-ui/react/tabs` (already how every other primitive in `src/components/ui/` is built — no
  new dependency), styled with this app's `--sidebar-*`/`--accent`/`--muted` tokens instead of the
  reference's literal `zinc`/`emerald`/`blue` Tailwind colors.
- Three tabs: **All**, **Carpetas**, **Campañas**. Selecting "Carpetas" or "Campañas" reveals a
  `Select` next to the tabs (reusing the existing `src/components/ui/select.tsx`) populated from
  the already-fetched `folders`/`campaigns` lists; choosing one sets `?folder=<id>` or
  `?campaign=<id>` and resets to page 1. Selecting "All" clears both.
- The existing status/type dropdowns and the search input are unchanged in appearance; only their
  `onChange` handlers change from local `setState` to updating the URL.

### Pagination control

New `Pagination`/`PaginationContent`/`PaginationItem`/`PaginationLink` in
`src/components/ui/pagination.tsx`, adapted from the reference's pill-with-jump-to-page layout, on
this app's own tokens (`bg-card`, `border-border`, `text-muted-foreground`, hover states matching
existing button conventions) and `lucide` chevron icons (matching every other icon in this app —
not `@tabler/icons-react`, an unused dependency this project doesn't have). Rendered under the QR
list, reflects `total`/`pageSize` from the server response; prev/first disabled on page 1, next/last
disabled on the last page. Page-size is fixed at 20 for this change — no page-size selector (YAGNI;
add one later if actually requested). The four chevron buttons are interactive icon elements, so
per this project's standing convention they render through `HoverMorphIcon`, not a bare `lucide`
import — same pattern already used for every other icon button in the app.

## Testing

The existing `src/modules/qr/*.test.ts` files are pure unit tests of pure functions (no DB) — none
of them are a precedent for testing a query. `listQrCodes`'s filtering and `countEventsForQrCodes`'s
grouping can't be verified by asserting on a Drizzle query-builder object without also proving the
resulting SQL does the right thing, so both need real rows to assert against — the same
live-local-Supabase-with-seeded-rows pattern the Phase 7 rollup job's tests use
(`docs/superpowers/specs/2026-09-09-phase7-analytics-design.md`'s Testing section), applied here for
the first time in the `qr` module rather than `analytics`:

- `listQrCodes`'s filter-building: seed a handful of QR codes spanning every status/mode/folder/
  campaign combination, call with each filter combination, assert exactly the expected subset (and
  its `total`) comes back.
- `countEventsForQrCodes`: seeded `tracking_events` rows across multiple QR codes (including one
  with zero scans, and a static QR with no `linkId`), confirm the returned map has the right counts
  and the static QR maps to `0` without erroring.
- Pagination edges: `total` exactly divisible by `pageSize`, `total < pageSize` (single page, both
  arrows disabled), `page` beyond the last page (should not 500 — clamp or 404, decided during
  `writing-plans`).

The `Tabs`/`Pagination`/`Select` UI itself is verified live in the browser, per this session's
established practice (screenshot before/after, click through folder and campaign selection, confirm
the URL updates and the list actually re-fetches with the new filter).
