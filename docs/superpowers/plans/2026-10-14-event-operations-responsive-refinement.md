# Event Operations Responsive Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center event operation content, clarify Check-in, improve the internal-form hierarchy, and make all event navigation tabs usable on desktop, tablet, and mobile.

**Architecture:** Preserve the existing page shells and business contracts. Adjust only container geometry, presentation copy, responsive composition, and navigation wrapping. Keep the wide shell for the navigation and Registrations table, while centering narrower content wrappers inside the other pages.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Base UI/shadcn components, existing QR/manual Check-in flow, Vitest.

## Global Constraints

- Keep the five routes `Editar | Registros | Check-in | Formulario interno | Resultados` visible and authorized exactly as today.
- Keep QR as the primary Check-in action and manual folio as fallback.
- Keep the existing `check ck-10` checkbox system and premium dropdown components.
- Do not change permissions, database behavior, server actions, audit, capacity bypass, email uniqueness, or check-in contracts.
- Do not redesign the Registrations table itself; its page remains wide.
- Do not commit or push until explicitly requested.
- Do not modify unrelated dirty or untracked worktree files.

---

## File Map

- Modify `app/(protected)/events/event-sub-nav.tsx` for responsive wrapping and centered desktop tabs.
- Modify `app/(protected)/events/[id]/edit/page.tsx` to center the edit content wrapper.
- Modify `app/(protected)/events/[id]/check-in/page.tsx` to center the Check-in content wrapper.
- Modify `app/(protected)/events/[id]/check-in/check-in-form.tsx` to clarify camera/manual operations and responsive composition.
- Modify `app/(protected)/events/[id]/internal-form/page.tsx` to center the internal-form wrapper.
- Modify `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx` to label and group search/results more clearly.
- Modify `app/(protected)/events/[id]/dashboard/page.tsx` to center the metrics wrapper.
- Update focused page tests only when a changed shell contract is asserted.

## Task 1: Center Narrow Event Content

**Files:**
- Modify: `app/(protected)/events/[id]/edit/page.tsx`
- Modify: `app/(protected)/events/[id]/check-in/page.tsx`
- Modify: `app/(protected)/events/[id]/internal-form/page.tsx`
- Modify: `app/(protected)/events/[id]/dashboard/page.tsx`
- Test: existing page tests under the four routes when their serialized shell is asserted

**Interfaces:**
- Consumes the existing page data and child components.
- Produces the same routes and child props with centered narrow wrappers.

- [ ] **Step 1: Add a failing shell assertion for Check-in**

In `app/(protected)/events/[id]/check-in/page.test.tsx`, assert that the serialized result contains the centered wrapper class:

```tsx
expect(JSON.stringify(result)).toContain("mx-auto flex w-full max-w-4xl flex-col gap-6");
```

- [ ] **Step 2: Run the focused page test and verify it fails**

Run: `pnpm vitest run "app/(protected)/events/[id]/check-in/page.test.tsx"`

Expected: FAIL because the current child wrapper is not centered.

- [ ] **Step 3: Add `mx-auto` to the narrow child wrappers**

Use these class shapes:

```tsx
<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
```

for Check-in and internal form, and:

```tsx
<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
```

for Editar and:

```tsx
<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
```

for Resultados. Keep the outer `max-w-[1440px]` shell and keep Registrations wide.

- [ ] **Step 4: Run focused page tests**

Run: `pnpm vitest run "app/(protected)/events/[id]/check-in/page.test.tsx" "app/(protected)/events/[id]/registrations/page.test.tsx" "app/(protected)/events/[id]/dashboard/page.test.tsx"`

Expected: PASS with unchanged route and data assertions.

## Task 2: Clarify And Recompose Check-in

**Files:**
- Modify: `app/(protected)/events/[id]/check-in/check-in-form.tsx:46-83`

**Interfaces:**
- Keeps `lookup`, `confirm`, QR lifecycle, manual dialog, result dialog, and server actions unchanged.
- Produces clear labels for camera and manual fallback with responsive tablet/mobile composition.

- [ ] **Step 1: Add the visible copy contract to the Check-in component test if available**

Assert these strings in the existing component test or page-level rendered output:

```tsx
expect(screen.getByText("Escanear QR")).toBeInTheDocument();
expect(screen.getByText("Cámara apagada")).toBeInTheDocument();
expect(screen.getByText("Ingreso manual")).toBeInTheDocument();
```

If no client render harness exists, use the focused lint/typecheck verification in Step 3.

- [ ] **Step 2: Replace ambiguous initial copy and preserve the two operational actions**

Use this structure for the visible panels, retaining the current `QrScanner` conditional and event handlers:

```tsx
<div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-start">
  <section className="rounded-xl border border-border bg-card p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-base font-semibold">Escanear QR</h2>
        <p className="mt-1 text-sm text-muted-foreground">Validá el pase del asistente con la cámara.</p>
      </div>
      <span className="shrink-0 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
        {scannerOpen ? "Lector activo" : "Cámara apagada"}
      </span>
    </div>
    {scannerOpen ? (
      <QrScanner active onDetected={lookup} onError={(message) => { setError(message); setScannerOpen(false); }} />
    ) : (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
        Presioná “Escanear QR” para activar el lector.
      </div>
    )}
  </section>

  <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
    <div>
      <h2 className="font-heading text-base font-semibold">Ingreso manual</h2>
      <p className="mt-1 text-sm text-muted-foreground">Usá el folio si no podés utilizar la cámara.</p>
    </div>
    <Button type="button" onClick={() => { setError(undefined); setScannerOpen(true); }} disabled={scannerOpen || pending}>
      {scannerOpen ? "Escaneando…" : "Escanear QR"}
    </Button>
    <Button type="button" variant="outline" onClick={() => setManualOpen(true)} disabled={pending}>
      Ingresar folio manual
    </Button>
    {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
  </section>
</div>
```

The existing dialogs remain rendered after these sections.

- [ ] **Step 3: Run focused Check-in checks**

Run: `pnpm eslint "app/(protected)/events/[id]/check-in/check-in-form.tsx" && pnpm typecheck`

Expected: PASS with no behavior changes to QR/manual lookup.

## Task 3: Improve Internal Form Hierarchy

**Files:**
- Modify: `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx:48-105`

**Interfaces:**
- Keeps `searchInternalRegistrationAction`, `updatePrimaryAttendeeAction`, `addInternalCompanionAction`, and `CompanionAddedDialog` behavior unchanged.
- Produces explicit search and result grouping.

- [ ] **Step 1: Add a labeled search section**

Wrap the current search form in:

```tsx
<section className="rounded-xl border border-border bg-card p-4">
  <div className="mb-3">
    <h2 className="font-heading text-base font-semibold">Buscar registro</h2>
    <p className="mt-1 text-sm text-muted-foreground">Buscá por nombre, correo o folio.</p>
  </div>
  <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
    {/* existing Input and Button */}
  </form>
</section>
```

- [ ] **Step 2: Label the result group and preserve responsive columns**

Add a result heading before the current registration grid:

```tsx
{registration && primary ? (
  <section>
    <div className="mb-3">
      <h2 className="font-heading text-base font-semibold">Registro encontrado</h2>
      <p className="mt-1 text-sm text-muted-foreground">Editá el titular o gestioná sus acompañantes.</p>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      {/* existing titular, agregar acompañante, and acompañantes actuales sections */}
    </div>
  </section>
) : null}
```

Keep the existing inner `Registro encontrado` summary, forms, premium `Select`, `aria-live` feedback, and success dialog. Do not change action payloads.

- [ ] **Step 3: Run focused internal-form checks**

Run: `pnpm eslint "app/(protected)/events/[id]/internal-form/internal-registration-form.tsx" && pnpm typecheck`

Expected: PASS.

## Task 4: Make Event Tabs Responsive Without Horizontal Clipping

**Files:**
- Modify: `app/(protected)/events/event-sub-nav.tsx:15-33`

**Interfaces:**
- Consumes the same `eventId`, `current`, and `role` props.
- Produces the same authorized links with responsive wrapping.

- [ ] **Step 1: Add a failing navigation class assertion if a nav test exists**

If no `EventSubNav` component test exists, extend one existing page test to assert the page still contains all five Admin labels in serialized output. The desired class contract is:

```tsx
expect(JSON.stringify(result)).toContain("flex-wrap");
```

- [ ] **Step 2: Replace horizontal overflow with controlled responsive wrapping**

Use a centered nav and links that wrap only on narrow screens:

```tsx
<nav className="w-full border-b border-border text-sm">
  <div className="mx-auto flex max-w-fit flex-wrap justify-center gap-x-1 gap-y-1">
    {tabs.map((tab) => (
      <Link
        key={tab.key}
        href={tab.href}
        className={
          tab.key === current
            ? "min-h-10 shrink-0 basis-[calc(50%-0.25rem)] border-b-2 border-primary px-3 py-2 text-center font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:basis-auto"
            : "min-h-10 shrink-0 basis-[calc(50%-0.25rem)] border-b-2 border-transparent px-3 py-2 text-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:basis-auto"
        }
      >
        {tab.label}
      </Link>
    ))}
  </div>
</nav>
```

Do not filter or reorder tabs differently at any breakpoint. Keep labels intact.

- [ ] **Step 3: Run navigation/page checks**

Run: `pnpm eslint "app/(protected)/events/event-sub-nav.tsx" "app/(protected)/events/[id]/check-in/page.tsx" "app/(protected)/events/[id]/internal-form/page.tsx" && pnpm typecheck`

Expected: PASS.

## Task 5: Responsive And Visual Verification

**Files:**
- Modify only the targets from Tasks 1-4 if verification reveals a concrete defect.

- [ ] **Step 1: Run the complete quality gate**

Run: `pnpm check`

Expected: lint, typecheck, all tests, and Next build pass.

- [ ] **Step 2: Run the Impeccable detector**

Run:

```bash
& "C:\Users\javier.enriquez\.agents\skills\impeccable\scripts\impeccable.cmd" detect --json "app/(protected)/events/event-sub-nav.tsx" "app/(protected)/events/[id]/check-in/check-in-form.tsx" "app/(protected)/events/[id]/internal-form/internal-registration-form.tsx" "app/(protected)/events/[id]/edit/page.tsx" "app/(protected)/events/[id]/check-in/page.tsx" "app/(protected)/events/[id]/internal-form/page.tsx" "app/(protected)/events/[id]/dashboard/page.tsx"
```

Expected: no new visual detector findings.

- [ ] **Step 3: Manually verify viewport behavior**

Confirm:

```text
1. Editar content is centered while navigation remains stable.
2. Check-in clearly explains inactive camera, QR activation, and manual fallback.
3. Check-in stacks cleanly on tablet and phone without shrinking the reader into an unusable column.
4. Formulario interno centers its search and result content.
5. Resultados metrics are centered.
6. Registros remains wide and readable.
7. All five tabs are visible without horizontal clipping on phone and tablet.
8. Active tab height, focus, and underline remain stable.
```

- [ ] **Step 4: Inspect the focused diff**

Run: `git diff -- "app/(protected)/events/event-sub-nav.tsx" "app/(protected)/events/[id]/edit/page.tsx" "app/(protected)/events/[id]/check-in/page.tsx" "app/(protected)/events/[id]/check-in/check-in-form.tsx" "app/(protected)/events/[id]/internal-form/page.tsx" "app/(protected)/events/[id]/internal-form/internal-registration-form.tsx" "app/(protected)/events/[id]/dashboard/page.tsx"`

Expected: only the approved responsive and hierarchy changes appear.

## Plan Self-Review

- Spec coverage: centered shells are Task 1, Check-in is Task 2, internal-form hierarchy is Task 3, tabs are Task 4, and responsive/accessibility verification is Task 5.
- Placeholder scan: all tasks include concrete classes, copy, commands, and expected results.
- Type consistency: all existing component props and action signatures remain unchanged.
- Scope: no business, permission, database, QR, or premium component replacement is planned.
