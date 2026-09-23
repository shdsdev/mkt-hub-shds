# Bulk QR Review Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one shared-design QR image in the bulk wizard Review step, generated from the first valid CSV URL.

**Architecture:** Keep the behavior inside `BulkQrImport`: derive `preview?.rows[0]?.url` and pass it with the current seven design fields to the existing `useQrPreview` hook. The Review markup renders exactly one image when the hook returns a URL; otherwise it renders a local empty state. No parser, validation, creation, server-action, or short-link code changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest 5.

## Global Constraints

- Modify only `app/(protected)/qr/bulk/bulk-qr-import.tsx` and its new focused component test.
- Reuse `app/(protected)/qr/use-qr-preview.ts` unchanged; pass the raw first `preview.rows` URL as `payload`, never a short-link ID.
- Pass `backgroundColor`, `foregroundColor`, `errorCorrectionLevel`, `logoUrl`, `dotsType`, `cornersSquareType`, and `cornersDotType` from the current shared `design` state.
- Render one review image only when `useQrPreview` returns a URL; missing preview data or an unavailable hook result uses the same empty state.
- Do not change CSV parsing or validation, UTM behavior, creation, server actions, short URLs, results, templates, or the individual QR wizard.
- Do not add dependencies, stage, commit, or push.

---

## File Structure

- Modify: `app/(protected)/qr/bulk/bulk-qr-import.tsx` — derives the Review payload, calls the existing preview hook, and adds the one-image/empty-state Review markup.
- Create: `app/(protected)/qr/bulk/bulk-qr-import.test.tsx` — mocks state and `useQrPreview` in the Node Vitest environment, then asserts the Review tree and hook contract.

### Task 1: Render The Shared Review Preview

**Files:**
- Create: `app/(protected)/qr/bulk/bulk-qr-import.test.tsx`
- Modify: `app/(protected)/qr/bulk/bulk-qr-import.tsx:3-13, 39-57, 141-160`

**Interfaces:**
- Consumes: `useQrPreview(params: QrPreviewParams): string | undefined` from `app/(protected)/qr/use-qr-preview.ts` and `preview.rows[0]?.url` from the existing `BulkQrCsvPreview` state.
- Produces: one Review `<img alt="Vista previa del código QR del lote" src={previewUrl}>` when a preview URL exists; otherwise the text `No hay una vista previa del código QR disponible.`

- [ ] **Step 1: Write the failing component test**

Create `app/(protected)/qr/bulk/bulk-qr-import.test.tsx` with a Node-safe structural test: mock `useState` to place the wizard in `"review"`, provide two valid rows and a complete non-default shared design, mock `useQrPreview` to return `"blob:bulk-preview"`, and recursively inspect the returned React element tree. Assert the hook receives only the first URL and all seven design fields, and assert exactly one image with the required alt text and source.

```tsx
expect(mocks.useQrPreview).toHaveBeenCalledWith({
  payload: "https://first.example/path",
  backgroundColor: "#112233",
  foregroundColor: "#fefefe",
  errorCorrectionLevel: "H",
  logoUrl: "https://cdn.example/logo.svg",
  dotsType: "rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
});
expect(findElements(tree, "img")).toEqual([
  expect.objectContaining({
    props: expect.objectContaining({
      alt: "Vista previa del código QR del lote",
      src: "blob:bulk-preview",
    }),
  }),
]);
```

In the same test file, add an empty-rows case with `useQrPreview` returning `undefined`. Assert it has no `img`, its text includes `No hay una vista previa del código QR disponible.`, and the hook was called with `payload: undefined` plus the same shared-design shape. Mock `../group-select`, `../qr-design-fields`, `@/components/ui/button`, and `lucide-react` as lightweight components so no DOM or UI-provider setup is required.

- [ ] **Step 2: Run the component test to verify it fails**

Run: `pnpm vitest run 'app/(protected)/qr/bulk/bulk-qr-import.test.tsx'`

Expected: FAIL because `BulkQrImport` does not import or call `useQrPreview`, and it has no Review preview image or empty state.

- [ ] **Step 3: Write the minimal Review implementation**

In `app/(protected)/qr/bulk/bulk-qr-import.tsx`, add the existing hook import and derive the raw first-row payload before the JSX return:

```tsx
import { useQrPreview } from "../use-qr-preview";

// Inside BulkQrImport, after canAdvance:
const previewUrl = useQrPreview({
  payload: preview?.rows[0]?.url,
  backgroundColor: design.backgroundColor,
  foregroundColor: design.foregroundColor,
  errorCorrectionLevel: design.errorCorrectionLevel,
  logoUrl: design.logoUrl,
  dotsType: design.dotsType,
  cornersSquareType: design.cornersSquareType,
  cornersDotType: design.cornersDotType,
});
```

Inside the existing Review section, after the group summary and before the row list, add the single conditional preview block:

```tsx
{previewUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={previewUrl}
    alt="Vista previa del código QR del lote"
    className="h-48 w-48 rounded-md border border-border bg-white p-2 object-contain"
  />
) : (
  <p className="text-sm text-muted-foreground">No hay una vista previa del código QR disponible.</p>
)}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run 'app/(protected)/qr/bulk/bulk-qr-import.test.tsx'`

Expected: PASS with both the first-valid-URL/shared-design image case and the empty-state/no-image case.

- [ ] **Step 5: Run affected regression tests and static checks**

Run: `pnpm vitest run 'app/(protected)/qr/bulk/bulk-qr-import.test.tsx' 'app/(protected)/qr/bulk/bulk-csv.test.ts' 'app/(protected)/qr/bulk/bulk-wizard-state.test.ts'`

Expected: PASS; the preview addition does not alter CSV parsing or wizard gating.

Run: `pnpm lint && pnpm typecheck`

Expected: PASS with no new lint or TypeScript errors.

- [ ] **Step 6: Review the scoped diff without committing**

Run: `git diff --check -- 'app/(protected)/qr/bulk/bulk-qr-import.tsx' 'app/(protected)/qr/bulk/bulk-qr-import.test.tsx'`

Expected: no output and exit code 0.

Run: `git diff -- 'app/(protected)/qr/bulk/bulk-qr-import.tsx' 'app/(protected)/qr/bulk/bulk-qr-import.test.tsx'`

Expected: only the hook import/call, one Review image-or-empty-state branch, and the focused component test; no staged, committed, or pushed changes.

## Self-Review

- Spec coverage: Task 1 passes the first valid `preview.rows` URL and every shared design field to the existing hook, renders one accessible image, and covers both a missing valid-row payload and unavailable preview URL with the same empty state.
- Scope: The file list excludes bulk creation, server actions, short URLs, CSV parsing/validation, UTM behavior, results, templates, and the individual QR wizard.
- Test fit: The new component test follows the repository's Vitest mocking convention and works with the configured Node test environment without a new dependency.
- Placeholder scan: No `TODO`, `TBD`, deferred behavior, or undefined interface remains.
- Type consistency: `QrPreviewParams` names match `QrDesignFieldsState` and the existing hook exactly.
