# Bulk QR Success Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a full-success bulk website QR import (every row created, no batch error), show a modal confirmation whose only action navigates to `/qr`.

**Architecture:** The Review step of `BulkQrImport` opens a dialog when the existing `summary` state satisfies the success condition. The dialog reuses the same Base UI primitive as the single-QR modal; `open` is derived from `summary` (no new state), and backdrop/Escape dismissals are ignored. `Aceptar` calls `router.push("/qr")`, which unmounts the wizard.

**Tech Stack:** React 19 client component, `@base-ui/react/dialog`, `next/navigation` `useRouter`, Vitest 5 (focal test framework), TypeScript strict.

## Global Constraints

- Work only in `app/(protected)/qr/bulk/bulk-qr-import.tsx` and `app/(protected)/qr/bulk/bulk-qr-import.test.tsx`.
- Do NOT add a `useState` (or any hook-backed flag): `bulk-qr-import.test.tsx` emulates `useState` with a fixed sequence of eight `mockReturnValueOnce` slots; a ninth hook would shift that sequence and break existing tests.
- `useRouter` from `next/navigation` is allowed; it is not React state.
- Exact copy (Spanish, fixed plural): title `Códigos QR creados con éxito`, message `Se crearon {created} códigos QR.` (`{created}` = `summary.created`), button `Aceptar`. Do not singularize for `created === 1`.
- Show condition is strict: `summary && !summary.error && summary.created > 0 && summary.failed === 0`. Partial success, pure failure, and any `error` must keep the existing failed-row list / error alert and never show the dialog.
- Dismissal paths (backdrop, Escape) are ignored via `onOpenChange={() => {}}`; nothing mutates `summary`. Only `Aceptar` leaves the dialog.
- Preserve unrelated working-tree changes (`plans/2026-09-17-user-management.md`, `Nuevo Documento de texto.txt`). No commit, stage, or push unless the user explicitly authorizes.

---
### Task 1: Success dialog in the bulk wizard

**Files:**
- Modify: `app/(protected)/qr/bulk/bulk-qr-import.tsx` (imports :3, component body after :58, render end :222-224)
- Modify: `app/(protected)/qr/bulk/bulk-qr-import.test.tsx` (mocks :5-23, `renderReview` :62-87, new tests after :146)

**Interfaces:**
- Consumes: `BulkQrImportSummary` from `../actions` pins `{ requested, created, failed, results, error? }`; `BulkQrImportResult` pins rows `{ rowNumber, title, status: "created", qrCodeId } | { rowNumber, title, status: "failed", error }`.
- Produces: the dialog's `Aceptar` button whose `onClick` invokes `router.push("/qr")` — no other module depends on it.

- [ ] **Step 1: Extend the test mocks for `next/navigation` and the dialog**

In `app/(protected)/qr/bulk/bulk-qr-import.test.tsx`:

Replace the `mocks` object (lines 5-11) with a single hoisted factory that closes over the `push` spy:

```tsx
const mocks = vi.hoisted(() => {
  const push = vi.fn();
  return {
    useRef: vi.fn(),
    useState: vi.fn(),
    useTransition: vi.fn(),
    useQrPreview: vi.fn(),
    createBulkWebsiteQrCodesAction: vi.fn(),
    push,
    useRouter: vi.fn(() => ({ push })),
  };
});
```

Add after the existing `vi.mock("../actions", ...)` line (line 21):

```tsx
vi.mock("next/navigation", () => ({ useRouter: mocks.useRouter }));
vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ open, children }: { open?: boolean; children: ReactNode }) => (open ? children : null),
    Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
    Backdrop: () => null,
    Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Trigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}));
```

Update `beforeEach` (lines 90-92) so the router implementation survives `vi.resetAllMocks()` (which wipes mock implementations):

```tsx
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.useRouter.mockImplementation(() => ({ push: mocks.push }));
  });
```

> `vi.resetAllMocks()` clears every mock's implementation, so `useRouter` must be reinstalled on every test. The `Dialog.Root` mock gates children on `open`, so a closed dialog renders nothing — assertions for absence can rely on `getText` not containing the title. `useRouter` lives in the same factory that defines `push`, so the `next/navigation` mock and the component both see the same spy.

- [ ] **Step 2: Run the focal tests to confirm the baseline still passes**

Run: `pnpm exec vitest run "app/(protected)/qr/bulk/bulk-qr-import.test.tsx"`
Expected: PASS, 3 tests (`BulkQrImport` describe), no mock-order errors.

- [ ] **Step 3: Write the failing tests for the dialog**

Append inside `describe(“BulkQrImport”, …)` after the last test (after line 146):

```tsx
  it("shows the success dialog and navigates to /qr on Aceptar", () => {
    mocks.useQrPreview.mockReturnValue(undefined);
    const rows = [
      { rowNumber: 1, url: "https://first.example/path", title: "First" },
      { rowNumber: 2, url: "https://second.example/path", title: "Second" },
    ];

    const tree = renderReview(rows, {
      requested: 2,
      created: 2,
      failed: 0,
      results: [
        { rowNumber: 1, title: "First", status: "created", qrCodeId: "qr-1" },
        { rowNumber: 2, title: "Second", status: "created", qrCodeId: "qr-2" },
      ],
    });

    expect(getText(tree)).toContain("Códigos QR creados con éxito");
    expect(getText(tree)).toContain("Se crearon 2 códigos QR.");
    const acceptButton = findButton(tree, "Aceptar");
    expect(acceptButton?.props.onClick).toBeTypeOf("function");
    acceptButton?.props.onClick?.();
    expect(mocks.push).toHaveBeenCalledWith("/qr");
  });

  it("does not show the dialog on partial success and keeps the failed rows", () => {
    mocks.useQrPreview.mockReturnValue(undefined);
    const rows = [
      { rowNumber: 1, url: "https://first.example/path", title: "First" },
      { rowNumber: 2, url: "https://second.example/path", title: "Second" },
    ];

    const tree = renderReview(rows, {
      requested: 2,
      created: 1,
      failed: 1,
      results: [
        { rowNumber: 1, title: "First", status: "created", qrCodeId: "qr-1" },
        { rowNumber: 2, title: "Second", status: "failed", error: "Dominio bloqueado" },
      ],
    });

    expect(getText(tree)).not.toContain("Códigos QR creados con éxito");
    expect(getText(tree)).toContain("Fila 2: Dominio bloqueado");
  });
```

Update `renderReview` so the eighth `useState` slot is the provided summary (default `null`), preserving the existing sequence (change lines 62-63 and line 73):

```tsx
function renderReview(rows: { rowNumber: number; url: string; title: string }[], summary: import("../actions").BulkQrImportSummary | null = null) {
  const setState = vi.fn();
  mocks.useRef.mockReturnValue({ current: null });
  mocks.useState
    .mockReturnValueOnce(["review", setState])
    .mockReturnValueOnce([{ rows, invalidRows: [] }, setState])
    .mockReturnValueOnce([undefined, setState])
    .mockReturnValueOnce([{ folderId: "folder-1" }, setState])
    .mockReturnValueOnce([design, setState])
    .mockReturnValueOnce([false, setState])
    .mockReturnValueOnce(["", setState])
    .mockReturnValueOnce([summary, setState]);
```

- [ ] **Step 4: Run the focal tests to verify they fail**

Run: `pnpm exec vitest run "app/(protected)/qr/bulk/bulk-qr-import.test.tsx"`
Expected: the two new tests FAIL (title "Códigos QR creados con éxito" not found); the three existing tests still PASS. Failure reason must be "dialog not rendered", not a mock/compile error.

- [ ] **Step 5: Implement the dialog in the component**

In `app/(protected)/qr/bulk/bulk-qr-import.tsx`:

Add imports (after line 8, the `useQrPreview` import):

```tsx
import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
```

Add the router hook and the derived open state (after line 58, next to the `summary` state):

```tsx
  const router = useRouter();
  const showSuccessDialog = Boolean(summary && !summary.error && summary.created > 0 && summary.failed === 0);
```

Add the dialog at the top level of the returned JSX, after the review `<section>` (after line 222, inside the wrapping `div`):

```tsx
        <Dialog.Root open={showSuccessDialog} onOpenChange={() => {}}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 bg-black/60" />
            <Dialog.Popup className="fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6">
              <Dialog.Title className="font-heading text-lg font-semibold">
                Códigos QR creados con éxito
              </Dialog.Title>
              <p className="mt-2 text-sm text-muted-foreground">
                Se crearon {summary?.created} códigos QR.
              </p>
              <div className="mt-6 flex justify-end">
                <Button type="button" onClick={() => router.push("/qr")}>Aceptar</Button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
```

- [ ] **Step 6: Run the focal tests to verify they pass**

Run: `pnpm exec vitest run "app/(protected)/qr/bulk/bulk-qr-import.test.tsx"`
Expected: PASS, 5 tests total (3 existing + 2 new).

- [ ] **Step 7: Typecheck and lint the changed files**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm exec eslint "app/(protected)/qr/bulk/bulk-qr-import.tsx" "app/(protected)/qr/bulk/bulk-qr-import.test.tsx"`
Expected: no errors.

- [ ] **Step 8: Run the full test suite**

Run: `pnpm test`
Expected: all existing tests PASS (142+ across 34+ files previously) plus the new bulk dialog tests. Flag any unrelated failures without altering them.

- [ ] **Step 9: Self-review diff**

Run: `git diff --stat` and `git diff -- "app/(protected)/qr/bulk"`
Expected: only the two intended files changed; `git diff --check` clean; unrelated working-tree files untouched.