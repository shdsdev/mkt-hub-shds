# QR List Pagination, N+1 Fix, and Folder/Campaign Filtering — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-24-qr-list-pagination-and-grouping-design.md`

**Goal:** Replace the QR list's unbounded fetch + N+1 scan-count queries + client-only filtering with
server-side pagination (20/page), a batched scan-count query, and URL-driven status/mode/folder/
campaign/search filters surfaced through a new All/Carpetas/Campañas tab bar and a pagination
control.

**Tech Stack:** Next.js 16 Server Components (`searchParams`), Drizzle ORM/Postgres, `zod`, React 19
client components for the interactive filter bar, `@base-ui/react/tabs` (new primitive), `lucide` +
`HoverMorphIcon` for icons, Vitest against the local Supabase stack for the two new query functions.

## Global Constraints

- Preserve unrelated working-tree state (`docs/superpowers/plans/2026-09-17-user-management.md`,
  `Nuevo Documento de texto.txt`) — don't touch, stage, or commit them.
- `src/modules/qr/index.ts` and `src/modules/analytics/index.ts` are the only import surface for
  other modules (ARCHITECTURE.md I-4) — every new exported function must be added there.
- `countEventsForQrCode` (singular) is not removed; `countEventsForQrCodes` (plural, batched) is
  additive.
- No new npm dependency — `Tabs`/`Pagination` are built on `@base-ui/react/*`, already installed.
- Commit only when explicitly asked, same as the rest of this session.

---

### Task 0 — Preserve the dashboard active-QR metric

**Files:** `src/modules/qr/service.ts`, `src/modules/qr/index.ts`,
`src/modules/qr/count-active-qr-codes.test.ts` (new), `app/(protected)/page.tsx`

- [ ] Write a `vi.mock("@/db/client", ...)` test for `countActiveQrCodes("org-1")` that proves it
  returns the terminal query's count and composes one organization/status-active query.
- [ ] Add and export `countActiveQrCodes(organizationId: string): Promise<number>` using one
  `count()` query constrained by `qrCodes.organizationId` and `qrCodes.status = "active"`.
- [ ] Replace the dashboard's `listQrCodes(orgId)` fetch and in-memory active filter with
  `countActiveQrCodes(orgId)`, keeping its displayed metric as an organization-wide count.
- [ ] Run: `pnpm vitest run src/modules/qr/count-active-qr-codes.test.ts` — expect PASS.

### Task 1 — Batched scan counts

**Files:** `src/modules/analytics/service.ts`, `src/modules/analytics/index.ts`,
`src/modules/analytics/count-events-for-qr-codes.test.ts` (new)

- [ ] Add `countEventsForQrCodes` to `service.ts` exactly as specified (keys off `linkId`, static
  QRs map to `0`, one grouped query for every dynamic QR in the input).
- [ ] Export it from `src/modules/analytics/index.ts`.
- [ ] Write a test that `vi.mock`s `@/db/client` (the only pattern this codebase actually uses for
  DB-touching functions — verified: no test file anywhere connects to a real database) with a fake
  chainable query returning a canned `{ linkId, count }[]`; assert the returned `Map` is correct
  across a mix of QR codes (shared `linkId` with scans, a `linkId` with zero matching rows, and a
  static QR with `linkId: null`).
- [ ] Run: `pnpm exec vitest run src/modules/analytics/count-events-for-qr-codes.test.ts` — expect
  PASS.

### Task 2 — Paginated, filtered `listQrCodes`

**Files:** `src/modules/qr/service.ts`, `src/modules/qr/index.ts`,
`src/modules/qr/list-qr-codes.test.ts` (new)

- [ ] Define `QrCodeListFilter` and change `listQrCodes`'s signature to
  `(organizationId: string, filter: QrCodeListFilter) => Promise<{ rows: QrCodeRow[]; total: number }>`
  per the spec: `eq()` filters for status/mode/folderId/campaignId, `ilike` search across
  `qrCodes.name`, `qrCodes.staticPayload`, joined `links.destinationUrl`, joined `shortLinks.slug`;
  `limit`/`offset` from `page`/`pageSize`; `orderBy(desc(qrCodes.createdAt), desc(qrCodes.id))`; a
  second `count()` query (same `WHERE`, no limit/offset) for `total`.
- [ ] Export the new type from `src/modules/qr/index.ts` alongside the existing `listQrCodes`
  export.
- [ ] Write a `vi.mock("@/db/client", ...)`-based test (same reasoning as Task 1 — no test in this
  repo touches a real database): spy on the mocked chain's `.where`/`.limit`/`.offset` and assert
  each filter combination produces the expected call arguments; document the search-narrowing
  behavior (matches slug, not a full pasted short URL) as a comment if it can't be asserted directly
  against a mock.
- [ ] Run: `pnpm exec vitest run src/modules/qr/list-qr-codes.test.ts` — expect PASS.

### Task 3 — Wire the route to the new signatures

**Files:** `app/(protected)/qr/page.tsx`

- [ ] Add a `zod` schema parsing `searchParams` (`page`, `status`, `mode`, `folder`, `campaign`,
  `q`) with the documented defaults.
- [ ] Replace `listQrCodes(orgId)` with `listQrCodes(orgId, filter)`; destructure `{ rows: qrCodes, total }`.
- [ ] Replace the per-row `await countEventsForQrCode(qr.id)` inside `Promise.all(qrCodes.map(...))`
  with one `countEventsForQrCodes(qrCodes)` call before the map, then read counts from the returned
  `Map` inside the (now synchronous) row-building loop — this removes the `Promise.all`'s need to be
  async per-row for the count specifically (other awaited work in that loop, if any, stays as-is).
- [ ] Pass `total`, the current parsed filter, and `pageSize` down to `QrList` as new props.
- [ ] Run `pnpm exec tsc --noEmit` — expect the now-mismatched `QrList` prop types to surface as
  errors; fix in Task 6, not here.

### Task 4 — `Tabs` primitive

**Files:** `src/components/ui/tabs.tsx` (new)

- [ ] Build `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` on `@base-ui/react/tabs`, following this
  project's existing primitive style (compare `src/components/ui/select.tsx`): `cn()`-merged
  classNames, `data-slot` attributes, this app's `--sidebar-*`/`--accent`/`--muted`/`--border`
  tokens — no literal `zinc-*`/`emerald-*`/`blue-*` colors from the reference component.
- [ ] No test file — this is a thin styling wrapper around a well-tested primitive, verified live in
  the browser in Task 7.

### Task 5 — `Pagination` primitive

**Files:** `src/components/ui/pagination.tsx` (new)

- [ ] Build `Pagination`/`PaginationContent`/`PaginationItem`/`PaginationLink` adapted from the
  user-supplied `pagination-14.tsx` reference: same pill-with-jump-to-page layout, this app's tokens
  instead of `neutral-*`, `lucide`'s `ChevronsLeft`/`ChevronLeft`/`ChevronRight`/`ChevronsRight`
  through `HoverMorphIcon` (per the spec's icon-convention note) instead of `@tabler/icons-react`,
  and the existing `src/components/ui/select.tsx` for the page-jump dropdown instead of
  `@/components/base-ui/select` (not installed).
- [ ] No test file — verified live in the browser in Task 7.

### Task 6 — Wire the filter bar and pagination into `QrList`

**Files:** `app/(protected)/qr/qr-list.tsx`

- [ ] Accept new props: `total: number`, `page: number`, `pageSize: number`, and the current
  filter values (status/mode/folder/campaign/search) — replacing the props/local state that no
  longer make sense once filtering moves server-side.
- [ ] Replace the local `statusFilter`/`typeFilter`/`search` `useState`s and the client-side
  `filteredRows` computation: reading current filter values from props (server-supplied, sourced
  from the URL) instead of local state.
- [ ] Add the `Tabs` (All/Carpetas/Campañas) above the existing status/mode `Select`s; selecting
  "Carpetas" or "Campañas" reveals a `Select` populated from the already-passed `folders`/
  `campaigns` props.
- [ ] Every filter control (tabs, the two existing selects, the new folder/campaign select, the
  search input) updates the URL via `useRouter().push` with `useSearchParams()`-derived params,
  always resetting `page` to `1` except the pagination control itself.
- [ ] Add the `Pagination` control below the list, wired to `total`/`page`/`pageSize`, updating only
  `?page=`.
- [ ] Run `pnpm exec tsc --noEmit` — expect clean (this is where Task 3's surfaced prop-type errors
  get resolved).

### Task 7 — Full verification

- [ ] Run `pnpm check` (lint, typecheck, full test suite, production build) — expect all green.
- [ ] Browser-verify against a clean build (this session's established pattern for this repo's dev
  server, which repeatedly serves stale CSS/JS mid-session — prefer a fresh `next build` +
  `node .next/standalone/server.js` on a scratch port over the long-lived `pnpm dev` instance):
  confirm the tab bar, folder/campaign select, search, and existing status/mode filters each update
  the URL and the list; confirm pagination controls advance/retreat and disable at the edges;
  confirm a QR search that only matches page 2 doesn't require being on page 2 first.
- [ ] Self-review: `git diff --stat` — confirm only the files listed above changed, plus the two new
  primitive files; no unrelated files touched.
