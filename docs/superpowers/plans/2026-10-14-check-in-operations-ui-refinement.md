# Check-in Operations UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve event operations UI without changing permissions, server actions, database contracts, or unrelated worktree changes.

**Architecture:** Keep the existing `EventSubNav`, `CheckInForm`, `CheckInResultDialog`, and `InternalRegistrationForm` boundaries. Apply layout and state styling at those boundaries, add focused presentation helpers only where repeated status logic would otherwise make JSX unclear, and preserve the existing QR/manual flow and Admin-only mutations.

**Tech Stack:** Next.js 16.3.4 App Router, React 19, TypeScript, Tailwind CSS, Base UI/shadcn components, Vitest, existing Lucide icons.

## Global Constraints

- Keep the navigation sequence `Editar | Registros | Check-in | Formulario interno | Resultados` stable.
- Keep QR as the primary check-in action and the eight-character manual folio as fallback.
- Keep the modal result interaction and individual companion check-in actions.
- Use green for eligible/accredited, yellow for already checked-in, and red for not-found/blocked states.
- Never use color as the only status signal; keep explicit titles and copy.
- Preserve existing checkbox animation and premium dropdown behavior.
- Preserve `ignoreCapacity: true`, Admin authorization, server actions, and audit behavior.
- Do not touch unrelated modified or untracked worktree files.
- Do not commit or push until explicitly requested by the user.

---

## File Map

- Modify `AGENTS.md` with persistent UI rules for checkboxes, dropdowns, semantic states, and responsive verification.
- Modify `app/(protected)/events/event-sub-nav.tsx` to stabilize tab sizing, overflow, focus, and active-state geometry.
- Modify `app/(protected)/events/[id]/check-in/check-in-form.tsx` to use the responsive two-column operations layout and place errors near the relevant controls.
- Modify `app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx` to add semantic state styling and accessible state labels without changing the result contract.
- Modify `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx` to improve responsive density and live feedback while preserving all actions.
- Add focused presentation tests beside the affected components only if the existing test setup supports these client components; otherwise verify the behavior with the existing suite and `pnpm check`.

## Task 1: Add Persistent UI Rules

**Files:**
- Modify: `AGENTS.md:1-9`

**Interfaces:**
- Produces project-level instructions that future UI changes must preserve.

- [ ] **Step 1: Add the rules after the generated Next.js block**

Append a stable project section with these exact requirements:

```md
## UI Rules

- Preserve the existing checkbox animations and visual states when extending forms.
- Preserve premium dropdown components and their transitions; do not replace them with native selects without an explicit reason.
- Pair semantic colors with visible text or an accessible icon; never communicate status by color alone.
- Check overflow, keyboard focus, disabled/loading/error states, and responsive composition for every UI change.
- Fix layout distribution before reducing typography when text is clipped despite available space.
```

- [ ] **Step 2: Inspect the resulting rule file**

Run: `pnpm prettier --check AGENTS.md`

Expected: the file is accepted by the repository formatter, or the command reports that Markdown formatting is not configured without changing the file.

## Task 2: Stabilize Event Navigation

**Files:**
- Modify: `app/(protected)/events/event-sub-nav.tsx:6-31`

**Interfaces:**
- Consumes the existing `eventId`, `current`, and `role` props.
- Produces the same links and role filtering with stable tab geometry.

- [ ] **Step 1: Add stable layout classes without changing routing**

Keep the existing tab data and role filter. Change only the presentation so the nav has a full-width overflow container and each link cannot shrink or change width when selected:

```tsx
return (
  <nav className="-mx-1 overflow-x-auto border-b border-border px-1 text-sm">
    <div className="flex min-w-max gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === current
              ? "shrink-0 border-b-2 border-primary px-3 py-2 font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              : "shrink-0 border-b-2 border-transparent px-3 py-2 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  </nav>
);
```

- [ ] **Step 2: Run the type and lint checks for the component**

Run: `pnpm eslint "app/(protected)/events/event-sub-nav.tsx"`

Expected: PASS with no new warnings.

## Task 3: Recompose Check-in Operations Layout

**Files:**
- Modify: `app/(protected)/events/[id]/check-in/check-in-form.tsx:46-58`

**Interfaces:**
- Keeps `lookup`, `confirm`, `ManualFolioDialog`, and `CheckInResultDialog` behavior unchanged.
- Produces a responsive layout with the scanner area and operator controls visible together on wide screens.

- [ ] **Step 1: Add the failing presentation assertions if the component test harness exists**

If `app/(protected)/events/[id]/check-in/check-in-form.test.tsx` exists, add assertions equivalent to:

```tsx
expect(screen.getByRole("button", { name: "Escanear QR" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Registrar acceso con código" })).toBeInTheDocument();
expect(screen.getByText("La cámara está inactiva")).toBeInTheDocument();
```

If it does not exist, do not introduce a test-only browser mock in this task; rely on the existing action and component checks in Task 5.

- [ ] **Step 2: Recompose the JSX without changing state transitions**

Replace the current single-column return body with this structure while retaining the existing conditional scanner and button handlers:

```tsx
return (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start">
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">Acceso de asistentes</h2>
          <p className="text-sm text-muted-foreground">Activá la cámara solo cuando estés listo para escanear.</p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
          {scannerOpen ? "Lector activo" : "Lector inactivo"}
        </span>
      </div>
      {scannerOpen ? (
        <QrScanner active onDetected={lookup} onError={(message) => { setError(message); setScannerOpen(false); }} />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          La cámara está inactiva
        </div>
      )}
    </section>

    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="font-heading text-base font-semibold">Registrar entrada</h2>
        <p className="text-sm text-muted-foreground">Usá QR como flujo principal o ingresá el folio manualmente.</p>
      </div>
      <Button type="button" onClick={() => { setError(undefined); setScannerOpen(true); }} disabled={scannerOpen || pending}>
        {scannerOpen ? "Escaneando…" : "Escanear QR"}
      </Button>
      <Button type="button" variant="outline" onClick={() => setManualOpen(true)} disabled={pending}>
        Registrar acceso con código
      </Button>
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    </section>

    <ManualFolioDialog open={manualOpen} onOpenChange={setManualOpen} pending={pending} onSubmit={lookup} />
    <CheckInResultDialog result={result} open={resultOpen} confirmationRequired={confirmationRequired} confirming={pending} onOpenChange={setResultOpen} onConfirm={confirm} onConfirmCompanion={confirm} />
  </div>
);
```

- [ ] **Step 3: Run focused checks**

Run: `pnpm eslint "app/(protected)/events/[id]/check-in/check-in-form.tsx"`

Expected: PASS with no new warnings.

## Task 4: Add Semantic Check-in Result States

**Files:**
- Modify: `app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx:7-24`

**Interfaces:**
- Consumes the existing `CheckInLookupResult` union.
- Produces the same callbacks and modal actions with an explicit visual state.

- [ ] **Step 1: Add a local status presentation map**

Define a local map after the `canConfirm` calculation. It must keep text and color together:

```tsx
const statusPresentation = result.kind === "eligible"
  ? { label: "Acreditado", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" }
  : result.kind === "already_checked_in"
    ? { label: "Ya ingresó", className: "border-amber-500/40 bg-amber-500/10 text-amber-100" }
    : { label: title, className: "border-destructive/40 bg-destructive/10 text-destructive" };
```

- [ ] **Step 2: Render the status presentation in the dialog header**

Keep the existing title and add a visible status row before attendee details:

```tsx
<div className={`rounded-lg border px-3 py-2 text-sm font-medium ${statusPresentation.className}`} role="status">
  {statusPresentation.label}
</div>
<DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
```

Do not remove the title, attendee data, companion list, or existing action conditions. Keep `Cerrar` for blocked and already-checked-in results.

- [ ] **Step 3: Verify all result variants**

Run: `pnpm vitest run "app/(protected)/events/[id]/check-in" src/modules/events/registration-status.test.ts`

Expected: PASS. If no component test exists for the dialog, manually verify eligible, already checked-in, not-found, cancelled, and waitlisted states through the existing check-in flow.

## Task 5: Improve Internal Form Density And Feedback

**Files:**
- Modify: `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx:45-95`

**Interfaces:**
- Keeps `searchInternalRegistrationAction`, `updatePrimaryAttendeeAction`, and `addInternalCompanionAction` unchanged.
- Keeps `ignoreCapacity: true`, Admin-only server checks, and existing `Select` components unchanged.

- [ ] **Step 1: Mark mutation feedback as live**

Change the message paragraph to:

```tsx
{message ? <p role="status" aria-live="polite" className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">{message}</p> : null}
```

- [ ] **Step 2: Add responsive section grouping**

Keep the search form at full width and change the result wrapper and sections to use a responsive grid:

```tsx
{registration && primary ? (
  <div className="grid gap-4 xl:grid-cols-2">
    <section className="rounded-xl border border-border bg-card p-4 xl:col-span-2">
      {/* existing registration summary and primary form */}
    </section>
    <section className="rounded-xl border border-border bg-card p-4">
      {/* existing companion form */}
    </section>
    <section className="rounded-xl border border-border bg-card p-4">
      {/* existing companion list */}
    </section>
  </div>
) : null}
```

Preserve all existing inputs, hidden fields, action callbacks, labels, and buttons inside their respective sections. Use `rounded-xl` consistently; do not replace `Select` with a native `<select>`.

- [ ] **Step 3: Run the focused internal-form checks**

Run: `pnpm eslint "app/(protected)/events/[id]/internal-form/internal-registration-form.tsx"`

Expected: PASS with no new warnings.

## Task 6: Verify Responsive And Accessibility Requirements

**Files:**
- Modify only the affected files from Tasks 1-5 if verification finds a concrete defect.

- [ ] **Step 1: Run targeted tests and static checks**

Run:

```bash
pnpm vitest run "app/(protected)/events/[id]/check-in" "app/(protected)/events/[id]/internal-form" src/modules/events/registration-status.test.ts
pnpm check
```

Expected: all targeted tests, lint, typecheck, and build pass.

- [ ] **Step 2: Verify keyboard and state behavior manually**

Confirm all of the following:

```text
1. The active navigation tab does not change width or move adjacent tabs.
2. Narrow viewports can scroll the navigation without clipping Check-in.
3. Check-in shows QR before manual fallback and keeps the camera inactive initially.
4. Error text is adjacent to the operator controls and has an alert role.
5. Eligible, already checked-in, not-found, cancelled, and waitlisted results have distinct semantic styling plus explicit text.
6. Companion actions remain individual and do not change capacity behavior.
7. Internal form fields retain premium Select behavior and multiple companion additions remain possible.
8. Keyboard focus is visible on navigation and buttons.
```

- [ ] **Step 3: Inspect the final diff**

Run: `git diff -- AGENTS.md "app/(protected)/events/event-sub-nav.tsx" "app/(protected)/events/[id]/check-in/check-in-form.tsx" "app/(protected)/events/[id]/check-in/check-in-result-dialog.tsx" "app/(protected)/events/[id]/internal-form/internal-registration-form.tsx" docs/superpowers/specs/2026-10-14-check-in-operations-ui-refinement-design.md docs/superpowers/plans/2026-10-14-check-in-operations-ui-refinement.md`

Expected: only the approved UI refinement files and the two planning documents appear. Do not stage or revert unrelated worktree changes.

## Plan Self-Review

- Spec coverage: navigation stability is Task 2, responsive Check-in is Task 3, semantic result states are Task 4, internal-form density and live feedback are Task 5, persistent rules are Task 1, and verification is Task 6.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step is required.
- Type consistency: existing result union, callback signatures, server actions, and role filtering remain unchanged.
- Scope: no database, permissions, server-action, or unrelated worktree changes are planned.
