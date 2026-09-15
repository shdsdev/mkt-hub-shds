# Bulk QR Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated `/qr/bulk` workflow that previews a two-column CSV and sequentially creates up to 200 dynamic website QR codes with Spanish row-level results.

**Architecture:** Keep CSV parsing and preview validation in a pure browser-safe module under the bulk route so it can be exhaustively tested without UI or server dependencies. Keep the sole mutating entry point as a typed Server Action in the existing QR action module; it revalidates every submitted row, checks authentication, rate limit, and the organization domain once, then reuses `createLink`, `createShortLink`, and `createDynamicQrCode` in source order. The bulk page is a client component for file reading, preview, pending state, and results, rendered by a protected server page.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5, Zod 4.5.4, Vitest 5, Tailwind CSS 4, existing Base UI shadcn components.

## Global Constraints

- Do not change the existing single-QR modal, website form, static forms, or either existing QR creation action.
- Do not add packages, database schema, migrations, storage, import history, CSV persistence, background processing, or rollback behavior.
- The CSV columns are exactly `URL` then `Titulo del codigo QR (referencia)`; header labels are ignored, but the first non-blank record is always the header.
- Support quoted CSV fields, embedded commas in quoted fields, CRLF/LF line endings, and blank-line skipping without a CSV dependency.
- A submitted title must be trimmed and contain 1-255 characters. Do not synthesize `QR sin nombre` or any fallback title.
- A submitted URL must be trimmed, at most 2048 characters, and start with `http://` or `https://` (case-insensitive), matching `createLink` validation.
- Preview and server validation must cap processing at 200 CSV data rows. Rows after row 200 are displayed as excluded and are never sent to the action.
- Process eligible rows sequentially in input order. Preserve earlier successes, record row failures, and continue after each failure; do not wrap the batch in a transaction.
- The server action must load organization domains once before row processing. Without a domain, return one Spanish batch-level error and create no row.
- Imported dynamic QRs use only the existing website defaults: `#1c1213`, `#f7edee`, error correction `M`, and `square` for dots, corner squares, and corner dots. Do not accept UTM, grouping, placement-image, logo, template, or design values from the CSV.
- Every successful QR gets a `create`/`qr_code` audit entry. Call `revalidatePath("/qr")` once only when at least one QR was created.
- All new labels, validation text, progress text, and result text are Spanish.
- Respect module boundaries: import QR, links, audit, and auth symbols only through their respective `@/modules/<module>` public indexes.
- Follow the existing shadcn/Base UI component APIs and semantic Tailwind tokens; use `gap-*`, not `space-*`, and do not introduce raw color utilities.
- Preserve all pre-existing worktree changes. Do not stage, commit, install, or modify unrelated files.

---

## File Structure

- Create: `app/(protected)/qr/bulk/bulk-csv.ts` - pure CSV tokenizer, preview validation, row-number preservation, and shared import-row types.
- Modify: `app/(protected)/qr/bulk/bulk-csv.test.ts` - test-first coverage for parser and preview behavior, replacing the incomplete current expectations.
- Modify: `app/(protected)/qr/bulk/template/route.ts` - retain the authenticated template endpoint and make its CSV payload and download headers testable constants.
- Create: `app/(protected)/qr/bulk/template/route.test.ts` - verifies the Spanish template content, filename, headers, and unauthenticated response.
- Modify: `app/(protected)/qr/actions.ts` - add the typed `createBulkWebsiteQrCodesAction` Server Action and its Zod validation without altering existing actions.
- Create: `app/(protected)/qr/bulk-actions.test.ts` - mocks public service boundaries to verify action guards, ordering, audit, revalidation, and partial success.
- Create: `app/(protected)/qr/bulk/bulk-qr-import.tsx` - client-side file picker, preview, one submission action, progress state, and final results.
- Create: `app/(protected)/qr/bulk/page.tsx` - protected-route page shell rendering `BulkQrImport`.
- Modify: `app/(protected)/qr/page.tsx` - add the `/qr/bulk` entry point without changing `QrList` data or the single-QR modal.

### Task 1: Build And Test The Pure CSV Preview Contract

**Files:**
- Create: `app/(protected)/qr/bulk/bulk-csv.ts`
- Modify: `app/(protected)/qr/bulk/bulk-csv.test.ts`

**Interfaces:**
- Produces:

```ts
export type BulkQrImportRow = {
  rowNumber: number;
  url: string;
  title: string;
};

export type BulkQrInvalidRow = {
  rowNumber: number;
  url: string;
  title: string;
  error: string;
};

export type BulkQrCsvPreview = {
  readyRows: BulkQrImportRow[];
  invalidRows: BulkQrInvalidRow[];
  excludedRows: Array<{ rowNumber: number; url: string; title: string }>;
  fileError?: string;
};

export function parseBulkQrCsv(csv: string): BulkQrCsvPreview;
```

- Consumed by: `app/(protected)/qr/actions.ts` for `BulkQrImportRow` and `app/(protected)/qr/bulk/bulk-qr-import.tsx` for preview rendering.

- [ ] **Step 1: Replace the current incomplete parser tests with failing behavior tests**

In `app/(protected)/qr/bulk/bulk-csv.test.ts`, import `parseBulkQrCsv` and assert the complete public preview shape. Use this table-driven fixture for the core valid input:

```ts
const result = parseBulkQrCsv(
  "URL,Titulo del codigo QR (referencia)\r\n" +
    'https://a.example,"Lanzamiento, otoño"\r\n' +
    "\r\n" +
    "http://b.example,Segundo QR\r\n",
);

expect(result).toEqual({
  readyRows: [
    { rowNumber: 1, url: "https://a.example", title: "Lanzamiento, otoño" },
    { rowNumber: 2, url: "http://b.example", title: "Segundo QR" },
  ],
  invalidRows: [],
  excludedRows: [],
});
```

Add one focused `it` for each required invalid condition, with exact Spanish messages:

```ts
expect(parseBulkQrCsv("URL,Titulo\nhttps://a.example,   \n").invalidRows).toEqual([
  {
    rowNumber: 1,
    url: "https://a.example",
    title: "",
    error: "La fila 1 no tiene un título válido.",
  },
]);

expect(parseBulkQrCsv("URL,Titulo\nftp://a.example,Uno\n").invalidRows).toEqual([
  {
    rowNumber: 1,
    url: "ftp://a.example",
    title: "Uno",
    error: "La fila 1 tiene una URL inválida. Usa http:// o https://.",
  },
]);

expect(parseBulkQrCsv("URL,Titulo\nhttps://a.example\n").invalidRows).toEqual([
  {
    rowNumber: 1,
    url: "https://a.example",
    title: "",
    error: "La fila 1 debe contener exactamente URL y título.",
  },
]);
```

Also add tests that:

```ts
expect(parseBulkQrCsv("").fileError).toBe("El archivo está vacío.");
expect(parseBulkQrCsv("URL,Titulo\n\n").fileError).toBe("El archivo no contiene filas para importar.");
expect(parseBulkQrCsv("URL,Titulo\nhttps://a.example,Uno,Extra\n").invalidRows[0]?.error)
  .toBe("La fila 1 debe contener exactamente URL y título.");
```

For the boundary, build 201 valid data rows and verify the first 200 are in `readyRows`, only source data row 201 is in `excludedRows`, and no excluded row is invalidated or made ready:

```ts
expect(result.readyRows).toHaveLength(200);
expect(result.excludedRows).toEqual([
  { rowNumber: 201, url: "https://example.com/201", title: "QR 201" },
]);
```

- [ ] **Step 2: Run the parser tests and confirm they fail because the module does not exist**

Run: `pnpm test -- app/(protected)/qr/bulk/bulk-csv.test.ts`

Expected: FAIL with a module-resolution error for `./bulk-csv`, not a passing test or an unrelated TypeScript error.

- [ ] **Step 3: Implement the tokenizer and preview validator minimally**

Create `app/(protected)/qr/bulk/bulk-csv.ts`. Keep the CSV tokenizer private and implement its state machine so a comma terminates a field only outside quotes, `""` becomes one literal quote inside a quoted field, and CRLF is normalized before record parsing. Export only the types and `parseBulkQrCsv` contract above.

Use these validation constants and helpers so client and server rules use the same field names and Spanish copy:

```ts
export const BULK_QR_MAX_ROWS = 200;

export function normalizeBulkQrRow(row: BulkQrImportRow): BulkQrImportRow {
  return { rowNumber: row.rowNumber, url: row.url.trim(), title: row.title.trim() };
}

export function validateBulkQrRow(row: BulkQrImportRow): string | undefined {
  if (!row.title || row.title.length > 255) return `La fila ${row.rowNumber} no tiene un título válido.`;
  if (!row.url || row.url.length > 2048 || !/^https?:\/\//i.test(row.url)) {
    return `La fila ${row.rowNumber} tiene una URL inválida. Usa http:// o https://.`;
  }
}
```

`parseBulkQrCsv` must: discard wholly blank records; return `fileError` for no records or header-only input; discard the first non-blank record as the header; enumerate the remaining non-blank records from one; place records after position 200 directly in `excludedRows`; reject non-two-field records before URL/title validation; and return normalized values in every preview array.

- [ ] **Step 4: Run the parser tests and confirm they pass**

Run: `pnpm test -- app/(protected)/qr/bulk/bulk-csv.test.ts`

Expected: PASS; the assertions prove quoted commas, CRLF, blank lines, data-row numbering, empty input, malformed records, whitespace-only titles, invalid schemes, and the 200-row boundary.

- [ ] **Step 5: Refactor only after green**

Keep the parser single-purpose. Remove duplicated trim/validation branches only if every test remains green. Do not add a generic CSV library or accept alternate column orders.

### Task 2: Secure And Test The Template Download

**Files:**
- Modify: `app/(protected)/qr/bulk/template/route.ts`
- Create: `app/(protected)/qr/bulk/template/route.test.ts`

**Interfaces:**
- Produces:

```ts
export const BULK_QR_TEMPLATE_FILENAME = "plantilla_codigos_qr.csv";
export const BULK_QR_TEMPLATE_CSV: string;
export async function GET(): Promise<Response>;
```

- Consumes: `getCurrentUser()` from `@/modules/auth`.

- [ ] **Step 1: Write failing route-handler tests**

In `app/(protected)/qr/bulk/template/route.test.ts`, mock only `@/modules/auth` and test the handler through its exported `GET` function. Assert unauthenticated access returns status `401` and no CSV body. Assert an authenticated call returns the documented download response:

```ts
expect(response.status).toBe(200);
expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
expect(response.headers.get("content-disposition")).toBe(
  'attachment; filename="plantilla_codigos_qr.csv"',
);
expect(await response.text()).toBe(
  "URL,Titulo del codigo QR (referencia)\r\n" +
    "http://www.tu-sitio.com,Mi codigo QR 1\r\n" +
    "http://www.tu-sitio.com,Mi codigo QR 2\r\n" +
    "http://www.tu-sitio.com,Mi codigo QR 3\r\n",
);
```

- [ ] **Step 2: Run the route tests and confirm they fail before the exported constants exist**

Run: `pnpm test -- app/(protected)/qr/bulk/template/route.test.ts`

Expected: FAIL because the new exported template constants are not yet present; the existing behavior must not make the new assertions pass accidentally.

- [ ] **Step 3: Make the existing handler’s contract explicit without changing its endpoint behavior**

In `app/(protected)/qr/bulk/template/route.ts`, export the filename and CRLF CSV string used by `GET`, then construct `Content-Disposition` from the filename:

```ts
export const BULK_QR_TEMPLATE_FILENAME = "plantilla_codigos_qr.csv";
export const BULK_QR_TEMPLATE_CSV =
  "URL,Titulo del codigo QR (referencia)\r\n" +
  "http://www.tu-sitio.com,Mi codigo QR 1\r\n" +
  "http://www.tu-sitio.com,Mi codigo QR 2\r\n" +
  "http://www.tu-sitio.com,Mi codigo QR 3\r\n";
```

Retain `getCurrentUser()` before constructing the response and retain status `401` for direct unauthenticated template requests. The parent protected layout controls browser-page redirects; this route handler remains an authenticated file endpoint.

- [ ] **Step 4: Run the route tests and confirm they pass**

Run: `pnpm test -- app/(protected)/qr/bulk/template/route.test.ts`

Expected: PASS with authenticated template headers/body and unauthenticated `401` covered.

### Task 3: Add The Typed Sequential Bulk Server Action With Tests

**Files:**
- Modify: `app/(protected)/qr/actions.ts`
- Create: `app/(protected)/qr/bulk-actions.test.ts`
- Consumes: `BulkQrImportRow`, `normalizeBulkQrRow`, and `validateBulkQrRow` from `./bulk/bulk-csv`.

**Interfaces:**
- Produces:

```ts
export type BulkQrImportResult =
  | { rowNumber: number; title: string; status: "created"; qrCodeId: string }
  | { rowNumber: number; title: string; status: "failed"; error: string };

export type BulkQrImportSummary = {
  requested: number;
  created: number;
  failed: number;
  results: BulkQrImportResult[];
  error?: string;
};

export async function createBulkWebsiteQrCodesAction(
  submittedRows: BulkQrImportRow[],
): Promise<BulkQrImportSummary>;
```

- Consumed by: `BulkQrImport` from `app/(protected)/qr/bulk/bulk-qr-import.tsx`.

- [ ] **Step 1: Write failing Server Action tests using public-boundary mocks**

In `app/(protected)/qr/bulk-actions.test.ts`, mock `@/modules/auth`, `@/modules/links`, `@/modules/qr`, `@/modules/audit`, `next/cache`, and `next/navigation` before importing the action. Do not mock database internals. Set the authenticated fixture to:

```ts
const user = {
  id: "user-1",
  email: "operator@example.com",
  profile: { organizationId: "org-1" },
};
const domain = { id: "domain-1" };
```

Write focused tests for each action boundary:

```ts
await expect(createBulkWebsiteQrCodesAction([])).resolves.toMatchObject({
  requested: 0,
  created: 0,
  failed: 0,
  results: [],
  error: "No hay filas válidas para crear.",
});
```

- unauthenticated caller invokes mocked `redirect("/login")` before rate limiting or service calls;
- rate limit rejection returns exactly `"Demasiadas acciones. Inténtalo de nuevo en breve."` and creates nothing;
- a missing domain returns exactly `"Primero agrega un dominio en la página de Enlaces."`, loads domains once, and creates nothing;
- invalid or duplicate submitted rows are rejected again by the action, report their source row number, and make no service calls;
- two valid rows produce calls in this exact order per row: `createLink`, `createShortLink`, `createDynamicQrCode`, `recordAudit`, then start the next row; `createShortLink` receives the selected `domain.id`; and the QR input contains only the normalized row values plus the specified website defaults;
- a `createShortLink` rejection for source row 2 produces one `{ status: "failed" }` result, does not audit or revalidate that row, and still attempts row 3;
- successful results contain `qrCodeId`, failed results contain no ID, and mixed output has accurate `requested`, `created`, and `failed` totals in source order;
- `revalidatePath("/qr")` is called once after a batch with one or more successes and never for an all-failed batch.

Use a call-log array instead of asserting only mock call counts for sequence behavior:

```ts
const callLog: string[] = [];
createLink.mockImplementation(async () => {
  callLog.push("link");
  return { id: `link-${callLog.length}` };
});
// Each other mock pushes "short", "qr", or "audit".
expect(callLog).toEqual(["link", "short", "qr", "audit", "link", "short", "qr", "audit"]);
```

- [ ] **Step 2: Run the action tests and confirm they fail because the action and types are absent**

Run: `pnpm test -- app/(protected)/qr/bulk-actions.test.ts`

Expected: FAIL with the missing `createBulkWebsiteQrCodesAction` export, rather than a false-positive test caused by mocks.

- [ ] **Step 3: Implement the minimum validated action in the existing action file**

At the end of `app/(protected)/qr/actions.ts`, add the exported types and action. Authenticate first, redirect unauthenticated callers, then rate-limit before input validation and mutation. Use a Zod array schema with `.max(BULK_QR_MAX_ROWS)` and an object schema equivalent to the pure-module fields:

```ts
const bulkQrRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  url: z.string(),
  title: z.string(),
});
```

Normalize and validate each submitted object with Task 1 helpers after Zod parsing. Return invalid rows as `{ rowNumber, title, status: "failed", error }`; do not silently drop them. If no row survives server validation, return the empty-summary error from Step 1.

Load `listDomains(user.profile.organizationId)` once after there is at least one validated row. For every valid row, use this exact sequential shape:

```ts
const link = await createLink({
  organizationId: user.profile.organizationId,
  destinationUrl: row.url,
});
const shortLink = await createShortLink({
  organizationId: user.profile.organizationId,
  linkId: link.id,
  domainId: domain.id,
});
const qrCode = await createDynamicQrCode({
  organizationId: user.profile.organizationId,
  linkId: link.id,
  shortLinkId: shortLink.id,
  name: row.title,
  backgroundColor: "#1c1213",
  foregroundColor: "#f7edee",
  errorCorrectionLevel: "M",
  dotsType: "square",
  cornersSquareType: "square",
  cornersDotType: "square",
});
await recordAudit({
  organizationId: user.profile.organizationId,
  userId: user.id,
  action: "create",
  resourceType: "qr_code",
  resourceId: qrCode.id,
  after: qrCode,
});
```

Wrap only the per-row sequence in `try`/`catch`; on failure append `{ rowNumber, title, status: "failed", error }`, using `error.message` for `Error` instances and `"No se pudo crear el código QR."` otherwise, then continue. Count only rows that completed all three create operations and have a QR ID. After the loop, call `revalidatePath("/qr")` exactly once iff `created > 0`.

- [ ] **Step 4: Run the Server Action tests and confirm they pass**

Run: `pnpm test -- app/(protected)/qr/bulk-actions.test.ts`

Expected: PASS; all guards, server-side revalidation, defaults, sequential service ordering, audit records, and partial-success behavior are verified.

- [ ] **Step 5: Run the action-adjacent type check**

Run: `pnpm typecheck`

Expected: exits `0`; in particular, `BulkQrImportRow`, `BulkQrImportResult`, and the `createDynamicQrCode` input agree on `rowNumber`, `title`, `qrCodeId`, and required QR grouping fields.

### Task 4: Build The Protected Bulk Import Page

**Files:**
- Create: `app/(protected)/qr/bulk/page.tsx`
- Create: `app/(protected)/qr/bulk/bulk-qr-import.tsx`

**Interfaces:**
- Consumes: `parseBulkQrCsv` and its preview types from `./bulk-csv`; `createBulkWebsiteQrCodesAction` and `BulkQrImportSummary` from `../actions`.
- Produces: protected `/qr/bulk` page and `BulkQrImport` client component.

- [ ] **Step 1: Write a failing component-level interaction test**

Create `app/(protected)/qr/bulk/bulk-qr-import.test.tsx`. Mock the Server Action only; use the actual parser. Render `BulkQrImport`, supply a `File` with one valid and one whitespace-title row through the file input, and assert that the Spanish preview separates the rows and the submit control shows the ready count:

```tsx
expect(screen.getByText("Listas para crear (1)")).toBeInTheDocument();
expect(screen.getByText("Filas con errores (1)")).toBeInTheDocument();
expect(screen.getByText("La fila 2 no tiene un título válido.")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Crear 1 código QR" })).toBeEnabled();
```

Add a pending/result test: resolve the mocked action with one created and one failed result, click submit, assert the button is disabled and shows `"Creando códigos QR..."` while unresolved, then assert the final totals and per-row result text once resolved. Use `await` queries rather than timing sleeps.

- [ ] **Step 2: Run the component test and confirm it fails before the component exists**

Run: `pnpm test -- app/(protected)/qr/bulk/bulk-qr-import.test.tsx`

Expected: FAIL with a missing `BulkQrImport` module/export. If the repository has no React DOM test environment configured, stop after recording that evidence and add the component test only once the existing Vitest configuration supports it; do not install a test package as part of this feature.

- [ ] **Step 3: Implement the protected page shell**

Create `app/(protected)/qr/bulk/page.tsx` as a Server Component:

```tsx
import { BulkQrImport } from "./bulk-qr-import";

export default function BulkQrImportPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-semibold">Importar códigos QR</h1>
        <p className="text-sm text-muted-foreground">
          Crea hasta 200 códigos QR dinámicos de sitio web desde un archivo CSV.
        </p>
      </div>
      <BulkQrImport />
    </div>
  );
}
```

Do not duplicate an auth check here: `app/(protected)/layout.tsx` already redirects unauthenticated page visits to `/login`.

- [ ] **Step 4: Implement the client import, preview, and results component**

Create `app/(protected)/qr/bulk/bulk-qr-import.tsx` with `"use client"`. Keep one state value for the parsed preview, one for `BulkQrImportSummary | null`, and one `isPending` value from `useTransition`. On file change, call `await file.text()` in the browser and pass the string to `parseBulkQrCsv`; do not upload or persist the file.

Render these states with semantic components and exact behavior:

```tsx
<a href="/qr/bulk/template" download>
  Descargar plantilla CSV
</a>
<input
  id="bulk-qr-csv"
  type="file"
  accept=".csv,text/csv"
  onChange={handleFileChange}
/>
```

- before selection: Spanish instructions naming both columns and the 200-row maximum;
- file error: an `Alert`-style error surface with `preview.fileError` and no create control;
- preview: three separately headed sections, `Listas para crear (${readyRows.length})`, `Filas con errores (${invalidRows.length})`, and `Filas excluidas por el límite (${excludedRows.length})`; show row number, URL/title values, and error text where applicable;
- submit: render only when `readyRows.length > 0`, call `startTransition(async () => setSummary(await createBulkWebsiteQrCodesAction(preview.readyRows)))`, disable it when pending, and label it `Crear ${readyRows.length} código QR` for one or `Crear ${readyRows.length} códigos QR` otherwise;
- pending: prevent a second request, retain the preview, and display `Creando códigos QR...`;
- final result: display `Solicitados:`, `Creados:`, and `Fallidos:` totals before an ordered row list. Success rows show `Fila ${rowNumber}: ${title} creada` and their QR ID. Failure rows show `Fila ${rowNumber}: ${title} - ${error}`. Render a link to `/qr` after the result.

Use only installed primitives (`Button` and `Separator`) where they improve the control or result structure; use semantic `section`, `h2`, `ol`, `ul`, and `p role="alert"` elements for the remaining content. Do not add or assume `Alert`, `Card`, `Badge`, modal, spinner, or toast components. Keep spacing with `flex flex-col gap-*` and use semantic tokens only.

- [ ] **Step 5: Run the component test if the existing environment supports it**

Run: `pnpm test -- app/(protected)/qr/bulk/bulk-qr-import.test.tsx`

Expected: PASS, or documented skip based on the Step 2 environment finding. In either case, run the parser and action tests because they do not require a browser environment:

Run: `pnpm test -- app/(protected)/qr/bulk/bulk-csv.test.ts app/(protected)/qr/bulk-actions.test.ts`

Expected: PASS.

### Task 5: Add The QR-Area Entry Point And Verify Scope

**Files:**
- Modify: `app/(protected)/qr/page.tsx`
- Verify: `app/(protected)/qr/create-qr-modal.tsx`
- Verify: `app/(protected)/qr/website-qr-form.tsx`
- Verify: `app/(protected)/qr/static-qr-form.tsx`

**Interfaces:**
- Produces: a visible `/qr/bulk` navigation entry without modifying the single-QR flow.

- [ ] **Step 1: Write a failing page-source assertion for the bulk entry**

Create `app/(protected)/qr/page.test.tsx` only if the existing test environment can import Server Component source. Assert that the page renders a link with `href="/qr/bulk"` and Spanish text `Importar por lote`. If the established Vitest environment cannot render Server Components, record the limitation and cover this in browser verification instead; do not add test dependencies.

- [ ] **Step 2: Run the entry test and confirm its initial failure**

Run: `pnpm test -- app/(protected)/qr/page.test.tsx`

Expected: FAIL for the missing `/qr/bulk` link, or the documented environment limitation from Step 1.

- [ ] **Step 3: Add a narrow entry control to the QR page header**

In `app/(protected)/qr/page.tsx`, import `Link` from `next/link` and retain all existing data fetches and `QrList` props. Change only the header wrapper so it retains the heading/description and adds a secondary navigation control:

```tsx
<div className="flex flex-wrap items-start justify-between gap-4">
  <div>
    {/* existing heading and description */}
  </div>
  <Link
    href="/qr/bulk"
    className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
  >
    Importar por lote
  </Link>
</div>
```

Do not alter `QrList`, `CreateQrModal`, its props, or any single-QR form. The bulk page is the dedicated entry; it is not another modal screen.

- [ ] **Step 4: Run focused verification**

Run: `pnpm test -- app/(protected)/qr/bulk/bulk-csv.test.ts app/(protected)/qr/bulk/template/route.test.ts app/(protected)/qr/bulk-actions.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: exits `0`.

- [ ] **Step 5: Perform browser verification without changing data**

Run: `pnpm dev`

Verify as an authenticated user:

- `/qr` exposes `Importar por lote` and the existing `Crear código QR` modal still opens unchanged.
- `/qr/bulk` shows Spanish instructions, template download, and accepts a CSV file only.
- The template downloads as `plantilla_codigos_qr.csv` with both documented headers and examples.
- A CSV containing quoted fields, CRLF, blank lines, one invalid URL, and one whitespace title previews ready/invalid rows with stable one-based data-row numbers before any creation request.
- A 201-row CSV visibly excludes row 201 and labels the create action for 200 rows.
- While creating a controlled mixed batch, duplicate submission is disabled; after completion, totals and each success/failure are visible and successful rows appear at `/qr`.
- A user with no organization domain receives the Spanish batch-level guidance and no row is created.

Stop the development server after verification. Do not create production records solely to test this feature; use the existing approved test environment or a disposable organization.

---

## Self-Review

### Spec Coverage

- Dedicated protected `/qr/bulk` route and QR-area entry: Tasks 4 and 5.
- Authenticated, Spanish CSV template with required filename and two-column examples: Task 2.
- Browser parsing, quoted CSV, CRLF, blank-line handling, local preview, row numbering, malformed/empty-file validation, and 200-row exclusion: Task 1 and Task 4.
- Required non-whitespace title and `http`/`https` URL policy with no generated title: Task 1 and server revalidation in Task 3.
- One authenticated, rate-limited server action that checks domains once and reuses link, short-link, and dynamic-QR services sequentially: Task 3.
- Partial success, no rollback, ordered row-level results, audit per success, and one conditional `/qr` revalidation: Task 3 and Task 4.
- Existing safe website defaults only, with no CSV UTM/grouping/image/template/logo/design fields: Task 3.
- Single QR flows are protected from behavior and UI changes: Task 5 verification.

### Placeholder Scan

- No `TODO`, `TBD`, “implement later,” undefined helper, or deferred validation step appears in this plan.
- The only conditional test steps are explicit environment guards: no React DOM test setup is currently evidenced in the repository, and the plan forbids installing one. Parser, template, action, type, and browser checks remain mandatory.
- No task instructs staging, committing, installing, schema changes, or unrelated worktree edits.

### Type Consistency

- `BulkQrImportRow` is defined in Task 1 before both the action and client consume it; it always carries `rowNumber`, `url`, and `title`.
- `BulkQrImportResult` is a discriminated union: successful rows have `status: "created"` and `qrCodeId`; failed rows have `status: "failed"` and `error`. The result UI only reads the property valid for that branch.
- `BulkQrImportSummary.requested` means the count sent from the ready preview rows; `created + failed === requested` for action-processed rows. Batch-level guard errors return zero counts and an empty results array.
- `normalizeBulkQrRow` and `validateBulkQrRow` are shared by preview and action, so server/client field names and Spanish validation messages cannot diverge.
- The bulk action passes `name: row.title` to `createDynamicQrCode`, matching required `QrGrouping.name`; it never passes the CSV row number into persistence.

## Result Contract

- Artifact: `docs/superpowers/plans/2026-09-10-bulk-qr-import.md`.
- Scope: implementation plan only; no application code, package installation, test execution, staging, or commit.
- Review status: self-reviewed for approved-design coverage, placeholders, and type consistency.
