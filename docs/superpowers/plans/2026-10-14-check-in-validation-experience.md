# Check-in Validation Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Check-in into a fast two-action operator flow with a persistent, category-colored result modal shared by QR and manual validation.

**Architecture:** Keep the existing server actions and domain result types. Make `CheckInForm` the small client-side state coordinator for idle, scanner, manual, validating, and result states. Make `CheckInResultDialog` the single visual renderer for every validation outcome, deriving client-category color from the existing `occupation` field and keeping status semantics separate.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Base UI Dialog, existing QR scanner, existing manual folio input, existing Check-in server actions, Vitest.

## Global Constraints

- Show exactly two entry actions: `Escanear QR` and `Ingresar código`.
- QR and manual validation feed the same result presentation.
- Keep the result visible until the host explicitly closes it or chooses the next action.
- Preserve existing QR/token validation, permissions, confirmation policy, audit, and server action payloads.
- Derive category color from `occupation`; do not add a database field or migration.
- Keep category color and access status as separate visual layers.
- Show color and category text together; never rely on color alone.
- Preserve the existing dark Marketing Hub visual system and responsive conventions.
- Do not redesign public pages, emails, or external attendee surfaces.
- Do not commit or push until explicitly requested.
- Preserve unrelated dirty worktree changes.

---

## File Map

- Modify `app/(protected)/events/[id]/check-in/check-in-form.tsx` to coordinate the entry modes and preserve result visibility.
- Modify `app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx` to render the category-colored attendee card and consistent status shell.
- Modify `app/(protected)/events/[id]/check-in/manual-folio-dialog.tsx` to align manual capture with the new visual flow while preserving segmented input behavior.
- Modify `app/(protected)/events/[id]/check-in/qr-scanner.tsx` only if the scanner needs a full-height responsive presentation or explicit cancel contract.
- Add/update focused tests for result presentation and Check-in state transitions where the repository test setup supports them.

## Task 1: Simplify The Check-in Entry Surface

**Files:**
- Modify: `app/(protected)/events/[id]/check-in/check-in-form.tsx`
- Test: existing Check-in component/page tests, or add a focused component test only if the current test setup supports client rendering

**Interfaces:**
- Consumes existing `lookupCheckInAction`, `confirmCheckInAction`, `QrScanner`, `ManualFolioDialog`, and `CheckInResultDialog` contracts.
- Produces a state coordinator with explicit `idle`, `scanner`, `manual`, `validating`, and `result` behavior.

- [ ] **Step 1: Add failing interaction coverage**

Cover the following observable behavior in the existing test style:

```text
1. Idle renders exactly `Escanear QR` and `Ingresar código` actions.
2. Selecting `Escanear QR` opens the scanner and does not render it in idle.
3. Selecting `Ingresar código` opens manual capture.
4. A successful lookup opens the result modal and closes scanner/manual capture.
5. Closing the result returns to the idle entry surface.
```

- [ ] **Step 2: Run the focused Check-in test and confirm the new expectations fail**

Run: `pnpm vitest run "app/(protected)/events/[id]/check-in/page.test.tsx"`

Expected: the new interaction expectations fail against the current two-panel composition or are skipped only if the existing page test mocks all client UI; in that case, add the smallest available client component test.

- [ ] **Step 3: Replace the persistent two-panel composition with the entry surface**

Use a mobile-first single operator surface with two visible actions:

```tsx
<section className="flex min-h-[min(72dvh,44rem)] flex-col justify-center rounded-2xl border border-border bg-card p-5 sm:p-8">
  <div className="max-w-xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Check-in operativo</p>
    <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-5xl">Validar acceso</h1>
    <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
      Escaneá el pase o ingresá el código. El resultado quedará visible hasta que el host decida continuar.
    </p>
    <div className="mt-8 grid gap-3 sm:flex">
      <Button type="button" onClick={openScanner} disabled={pending} className="min-h-12 flex-1 sm:flex-none">
        Escanear QR
      </Button>
      <Button type="button" variant="outline" onClick={openManual} disabled={pending} className="min-h-12 flex-1 sm:flex-none">
        Ingresar código
      </Button>
    </div>
  </div>
</section>
```

Do not change server actions or lookup payloads. Reset stale errors when starting either mode.

- [ ] **Step 4: Run focused checks**

Run: `pnpm eslint "app/(protected)/events/[id]/check-in/check-in-form.tsx" && pnpm typecheck`

Expected: PASS.

## Task 2: Align Scanner And Manual Capture Modes

**Files:**
- Modify: `app/(protected)/events/[id]/check-in/check-in-form.tsx`
- Modify: `app/(protected)/events/[id]/check-in/manual-folio-dialog.tsx`
- Modify: `app/(protected)/events/[id]/check-in/qr-scanner.tsx` only if required by the current contract

**Interfaces:**
- Preserve `QrScanner` detection/error callbacks and `ManualFolioDialog` submit/pending callbacks.
- Produce full-height mobile/tablet capture surfaces with explicit cancel/back actions.

- [ ] **Step 1: Add capture-mode coverage**

Verify that camera cancellation returns to idle, manual cancellation returns to idle, and pending state disables duplicate submissions.

- [ ] **Step 2: Present QR capture as a focused stage**

The scanner mode must include:

```tsx
<section className="fixed inset-0 z-50 flex min-h-[100dvh] flex-col bg-background p-4 sm:p-6">
  <header className="flex items-center justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cámara activa</p>
      <h2 className="mt-2 text-xl font-semibold">Apuntá al QR</h2>
    </div>
    <Button type="button" variant="ghost" onClick={closeScanner}>Cancelar</Button>
  </header>
  <div className="flex flex-1 items-center justify-center py-8">
    <QrScanner active onDetected={lookup} onError={handleScannerError} />
  </div>
</section>
```

Use the existing scanner implementation and camera permission/error behavior. Do not add a second QR decoder.

- [ ] **Step 3: Align manual capture without replacing the segmented input**

Keep the existing segmented folio input and add visible context, auto-focus, `Validar código`, and `Cancelar`. The manual mode must submit through the existing `onSubmit={lookup}` path.

- [ ] **Step 4: Run focused checks**

Run: `pnpm eslint "app/(protected)/events/[id]/check-in/check-in-form.tsx" "app/(protected)/events/[id]/check-in/manual-folio-dialog.tsx" "app/(protected)/events/[id]/check-in/qr-scanner.tsx" && pnpm typecheck`

Expected: PASS.

## Task 3: Build The Shared Result Card

**Files:**
- Modify: `app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx`
- Test: focused result-dialog test if supported by the existing test stack

**Interfaces:**
- Consumes the existing `CheckInLookupResult`, `confirmationRequired`, `confirming`, `onOpenChange`, `onConfirm`, and `onConfirmCompanion` props.
- Produces one responsive modal shell for eligible, already checked-in, blocked, and not-found outcomes.

- [ ] **Step 1: Add failing presentation coverage**

Cover:

```text
1. Eligible attendee shows full name, phone, company, email, category label, and `Acceso correcto`.
2. Category mapping renders Distributor/a orange, Fabricante blue, Arquitecto/a green, Decorador/a yellow, and Instalador/a o técnico/a red.
3. Already checked-in, cancelled, waitlisted, and not-found states preserve distinct text/status semantics.
4. The close action calls `onOpenChange(false)`.
5. Confirmation-required eligible state exposes the existing confirmation action.
```

- [ ] **Step 2: Add a pure category/status presentation mapping**

Keep the mapping local to the result component or extract a small same-folder utility only if tests need it:

```ts
const categoryPresentation = {
  distributor: { label: "Distribuidor/a", className: "bg-orange-500 text-orange-950" },
  manufacturer: { label: "Fabricante", className: "bg-blue-500 text-blue-950" },
  architect: { label: "Arquitecto/a", className: "bg-green-500 text-green-950" },
  decorator: { label: "Decorador/a", className: "bg-yellow-400 text-yellow-950" },
  "installer-technician": { label: "Instalador/a o técnico/a", className: "bg-red-500 text-red-950" },
} as const;
```

Use a neutral fallback for missing/unknown occupation without relying on color alone.

- [ ] **Step 3: Replace the compact result body with the card-first modal**

The known-attendee layout must include:

```tsx
<DialogPrimitive.Popup className="fixed inset-0 z-50 m-auto flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl flex-col overflow-y-auto rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:p-5">
  <div className={`overflow-hidden rounded-xl ${category.className}`}>
    <div className="flex items-start justify-between gap-4 p-5 sm:p-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{category.label}</p>
        <DialogPrimitive.Title className="mt-3 max-w-[12ch] text-4xl font-black leading-[0.95] tracking-[-0.06em] sm:text-6xl">
          {attendee.fullName}
        </DialogPrimitive.Title>
      </div>
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white text-4xl font-black text-emerald-600 sm:h-20 sm:w-20 sm:text-5xl" aria-label="Acceso correcto">✓</div>
    </div>
    <div className="grid gap-4 border-t border-black/15 p-5 sm:grid-cols-3 sm:p-7">
      <Fact label="Teléfono" value={attendee.phone ?? "No registrado"} />
      <Fact label="Empresa" value={attendee.company ?? "No registrada"} />
      <Fact label="Correo" value={attendee.email} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/15 p-5 text-sm font-semibold sm:p-7">
      <StatusBadge kind={result.kind} />
      <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
    </div>
  </div>
</DialogPrimitive.Popup>
```

Use an icon from the existing icon library if the project already has one; do not introduce emoji as the production verification mark. Keep companion confirmation actions available below the card where applicable.

- [ ] **Step 4: Keep status and category visually independent**

Implement the status badge separately from category classes:

```text
eligible             -> green + check + `Acceso correcto`
already_checked_in   -> amber + info + `Ya registró entrada`
cancelled            -> red + blocked + `Registro cancelado`
waitlisted           -> red + blocked + `Lista de espera`
not_found            -> red + blocked + `No encontrado`
```

For `not_found`, render the same modal shell but omit attendee facts because no attendee exists.

- [ ] **Step 5: Run focused result checks**

Run: `pnpm eslint "app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx" && pnpm typecheck`

Expected: PASS.

## Task 4: End-to-End Check-in Verification

**Files:**
- Modify only files from Tasks 1-3 if a concrete verification failure requires it.

- [ ] **Step 1: Run affected tests**

Run:

```bash
pnpm vitest run "app/(protected)/events/[id]/check-in/page.test.tsx" "src/modules/events/check-in-result.test.ts"
```

Expected: all affected tests PASS.

- [ ] **Step 2: Run complete quality gate**

Run: `pnpm check`

Expected: lint, typecheck, all tests, and production build PASS.

- [ ] **Step 3: Run the UI detector**

Run:

```bash
& "C:\Users\javier.enriquez\.agents\skills\impeccable\scripts\impeccable.cmd" detect --json "app/(protected)/events/[id]/check-in/check-in-form.tsx" "app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx" "app/(protected)/events/[id]/check-in/manual-folio-dialog.tsx" "app/(protected)/events/[id]/check-in/qr-scanner.tsx"
```

Expected: no new detector findings.

- [ ] **Step 4: Manually verify all viewport classes**

Verify at `320`, `375`, `414`, `768`, `1024`, and `1440` widths:

```text
1. Idle shows two clear actions with no horizontal overflow.
2. Camera mode fills the available viewport and has a reachable Cancel action.
3. Manual mode focuses the code input and preserves segmented entry.
4. Result modal is centered/large on desktop and near-full-screen on mobile.
5. Category card colors are visible and category text remains readable.
6. Status text and icon remain understandable without color perception.
7. Result stays open until host closes it.
8. Loading, confirmation, retry, and error states remain operable.
9. Keyboard focus enters and exits dialogs correctly.
```

- [ ] **Step 5: Inspect the focused diff**

Run:

```bash
git diff -- "app/(protected)/events/[id]/check-in/check-in-form.tsx" "app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx" "app/(protected)/events/[id]/check-in/manual-folio-dialog.tsx" "app/(protected)/events/[id]/check-in/qr-scanner.tsx"
```

Expected: only the approved Check-in experience changes appear; no migration, server validation, permission, or audit changes are introduced.

## Plan Self-Review

- Spec coverage: entry surface is Task 1, QR/manual capture is Task 2, shared card and statuses are Task 3, and responsive/accessibility verification is Task 4.
- Placeholder scan: every step has concrete files, behavior, code shapes, commands, and expected results.
- Type consistency: the plan preserves `CheckInLookupResult`, `confirmationRequired`, and existing confirmation callbacks.
- Scope: the plan changes presentation/state coordination only and adds no database migration.
