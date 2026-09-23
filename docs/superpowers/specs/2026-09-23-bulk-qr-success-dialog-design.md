# Design: Bulk QR Success Dialog

When a bulk website QR import finishes with a full success (every requested row created, no batch error), the Review step opens a modal confirmation whose only action navigates the operator to `/qr`. Partial failures keep the existing failed-row report and never show the dialog.

## Context

- Location: update `app/(protected)/qr/bulk/bulk-qr-import.tsx` only.
- `handleCreate` already stores the `createBulkWebsiteQrCodesAction` result in the existing `summary` state (`BulkQrImportSummary`: `requested`, `created`, `failed`, `results`, optional `error`).
- Today the Review step renders `summary.error` as an alert and renders failed rows when `summary.failed > 0`; there is no success confirmation and no navigation after a clean run.
- The dialog must reuse the same primitive as `app/(protected)/qr/create-qr-modal.tsx`: `Dialog` from `@base-ui/react/dialog` (`Dialog.Root`, `Dialog.Portal`, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Title`).

## Rules

1. **Show condition.** The dialog is open if and only if `summary` exists, `summary.error` is absent, `summary.created > 0`, and `summary.failed === 0`.
2. **No new state.** Derive `open` directly from `summary` with the condition above. Do not add a `useState` (or any other hook-backed flag): `bulk-qr-import.test.tsx` emulates `useState` with a fixed sequence of eight `mockReturnValueOnce` slots, and a ninth hook would shift that sequence and break existing tests. `useRouter` from `next/navigation` is allowed; it is not state.
3. **Copy (exact, Spanish).**
   - Title (`Dialog.Title`): `Códigos QR creados con éxito`
   - Message: `Se crearon {created} códigos QR.` where `{created}` is `summary.created`. The plural wording is fixed; do not singularize for `created === 1`.
   - Button label: `Aceptar`
4. **Controlled open, no dismiss paths.** `Dialog.Root` receives `open={...derived...}` and an `onOpenChange` handler that ignores close requests: backdrop clicks and Escape may invoke `onOpenChange(false)`, but nothing mutates `summary`, so `open` stays `true` and the dialog remains visible. The only way to leave the dialog is the `Aceptar` button.
5. **Accept action.** `Aceptar` calls `router.push("/qr")` (`useRouter` from `next/navigation`). Navigation unmounts the wizard; no local reset of `summary` is required or allowed as a close mechanism.
6. **Structure.** Render `Dialog.Portal` → `Dialog.Backdrop` → `Dialog.Popup` containing `Dialog.Title`, the message paragraph, and a single `Aceptar` button, following the visual language of `create-qr-modal.tsx` (`rounded-lg border border-border bg-card p-6` container).

## Exclusions

- No changes to `createBulkWebsiteQrCodesAction`, `BulkQrImportSummary`, CSV parsing, grouping, design fields, templates, or the single-QR modal.
- No new `useState`/`useReducer` flags derived from `summary` (see Rule 2).
- No success toast, redirect on action completion, auto-close timer, close (X) control, or second button.
- No dialog for partial success (`created > 0` and `failed > 0`), pure failure (`created === 0`), or any summary carrying `error`.
- No change to the existing failed-row list or the `summary.error` alert; they remain the sole feedback for non-clean outcomes.
- No schema, package, or route changes; no commit, stage, or push as part of the spec task.

## Errors

| Outcome after the action | Dialog | Existing UI |
|---|---|---|
| `error` present (rate limit, missing domain, preflight, template save, …) | Hidden (`created` is `0` and `error` is set) | Batch error alert unchanged |
| `failed > 0` (with or without `created > 0`) | Hidden | Failed-row list unchanged; successful rows, if any, are not re-reported |
| `created > 0`, no `error`, `failed === 0` | Open | Review step stays mounted underneath; dialog is the confirmation layer |
| `created === 0`, no `error`, `failed === 0` (defensive) | Hidden | No new UI required; action currently never returns this shape for a submitted batch |

Dismissal attempts (backdrop, Escape) are not errors: they are ignored per Rule 4 and require no user-visible feedback.

## Minimum Test

Extend `app/(protected)/qr/bulk/bulk-qr-import.test.tsx` without changing the eight-slot `useState` sequence:

1. Mock `next/navigation` with a shared `push` spy and mock `@base-ui/react/dialog` to passthrough components that still render `Title`/children (keeps the test independent of Base UI portal behavior).
2. Full success: supply the eighth `useState` slot with `{ requested: 2, created: 2, failed: 0, results: [...] }`. Assert the title `Códigos QR creados con éxito`, the message `Se crearon 2 códigos QR.`, and that clicking `Aceptar` calls `push` with `"/qr"`.
3. Suppressed dialog: supply a summary with `failed > 0` (and/or `error`). Assert the title is absent and the existing failed-row text still renders.

## Self-Review

- No `TBD`/`TODO`/placeholders; show condition, copy, navigation target, and dismissal behavior are each fully specified.
- `open` derivation and the fixed eight-slot `useState` mock constraint are stated in the same rule so they cannot be implemented apart.
- Partial success is explicitly excluded and routed to the unchanged failed-row list — no competing interpretation with Rule 1.
- `{created}` is defined as `summary.created`, and the fixed plural avoids a second unresolved copy decision.
- Scope is one component file plus one test file; server action, summary type, and single-QR flows are untouched.
