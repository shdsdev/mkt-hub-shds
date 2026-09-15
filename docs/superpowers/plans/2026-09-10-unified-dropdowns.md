# Unified Select and Dropdown Popups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seven native select hosts with one shadcn Base UI Select while giving Select and DropdownMenu a shared compact, theme-aware popup treatment without changing behavior or submitted values.

**Architecture:** Add shadcn's generated Base UI Select source at the configured UI alias, then constrain its popup and the existing Base UI DropdownMenu popup through shared semantic CSS custom properties in `app/globals.css`. Migrate each host by preserving its current value ownership: uncontrolled UTM selection, native-form default domain selection, and the existing controlled state unions for QR filters, QR correction, and analytics granularity.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript 5 strict mode, Tailwind CSS 4, shadcn Base UI (`@base-ui/react` 1.8.0), Vitest 5.

## Global Constraints

- Use the configured Base UI shadcn registry only: `pnpm exec shadcn add select`; do not install, copy, or depend on the Watermelon registry item.
- Before adding Select, run `pnpm exec shadcn add select --dry-run` and `pnpm exec shadcn add select --diff "src/components/ui/select.tsx"`; inspect the output and never pass `--overwrite`.
- Keep Select and DropdownMenu popup colors theme-aware through `--popover`, `--popover-foreground`, `--border`, and `--accent`; do not hardcode theme colors.
- Define and consume `--floating-popup-radius: var(--radius-sm)`, `--floating-popup-padding: 4px`, `--floating-popup-item-padding-block: 4px`, `--floating-popup-item-padding-inline: 6px`, and `--floating-popup-offset: 4px`.
- Keep a shared semantic elevation token and a 100ms primitive-state/transform-origin open-close transition.
- Select popups use `w-(--anchor-width)`, `max-h-(--available-height)`, and primitive portal positioning. The sidebar account menu retains `className="w-64"`, `side="top"`, and its current trigger content.
- Preserve all Spanish text, server actions, option values, form field names, disabled behavior, and current controlled-state unions.
- Preserve every pre-existing working-tree change, especially loaders, tooltips, themes, QR cards, and analytics loading state. Do not reformat or revert unrelated code.
- The repository has Vitest but no DOM renderer or end-to-end runner. Do not add test packages for this migration; use the existing unit suite, typecheck/build, and the concrete browser verification checklist in Task 6.
- Do not commit. A commit may be made only after an explicit user request.

---

## File Structure

- Create: `src/components/ui/select.tsx` — shadcn Base UI Select composition with standard Trigger, Content, Group, Item, Value, and scroll primitives.
- Modify: `app/globals.css` — shared semantic floating-popup custom properties.
- Modify: `src/components/ui/dropdown-menu.tsx` — consume the shared popup properties without altering its public API.
- Modify: `app/(protected)/links/link-form.tsx` — migrate the UTM preset picker while retaining imperative UTM input population.
- Modify: `app/(protected)/links/[id]/short-link-form.tsx` — migrate the domain picker while retaining `domainId` form submission.
- Modify: `app/(protected)/qr/static-qr-form.tsx` — migrate static QR correction level selection.
- Modify: `app/(protected)/qr/website-qr-form.tsx` — migrate website QR correction level selection.
- Modify: `app/(protected)/qr/qr-list.tsx` — migrate the controlled status and type filters.
- Modify: `app/(protected)/analytics/[linkId]/scans-panel.tsx` — migrate the controlled granularity picker while preserving the fetch dependency.

### Task 1: Inspect and Add the Base UI Select Source

**Files:**
- Create: `src/components/ui/select.tsx`
- Modify: none before the generated source has been inspected
- Test: no new automated test file; this task adds generated shadcn source and is covered by the typecheck in Task 6

**Interfaces:**
- Consumes: `components.json` aliases (`@/components/ui`) and `@base-ui/react/select` 1.8.0.
- Produces: `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectTrigger`, and `SelectValue` from `@/components/ui/select`.

- [ ] **Step 1: Confirm the registry target is absent and inspect the pending addition**

Run: `Test-Path "src/components/ui/select.tsx"; pnpm exec shadcn add select --dry-run`

Expected: `False`, then a dry-run reporting exactly one created file, `src/components/ui/select.tsx`, and no dependency addition because `cn` is already installed.

- [ ] **Step 2: Inspect the exact generated diff before adding it**

Run: `pnpm exec shadcn add select --diff "src/components/ui/select.tsx"`

Expected: a create-only diff importing `SelectPrimitive` from `@base-ui/react/select`, `cn` from `cn`, and Lucide `ChevronDownIcon`, `ChevronUpIcon`, and `CheckIcon`; no existing file is changed.

- [ ] **Step 3: Add the generated component without overwrite**

Run: `pnpm exec shadcn add select`

Expected: only `src/components/ui/select.tsx` is created. Do not use `--overwrite`; stop if the command reports any other changed path.

- [ ] **Step 4: Verify the generated public surface and Base UI form contract**

Run: `rg -n "^(const Select|function Select(Content|Group|Item|Trigger|Value)|export \{)" "src/components/ui/select.tsx"; rg -n "name\?: string|hidden input" "node_modules/@base-ui/react/select/root/SelectRoot.d.ts"`

Expected: the component exports the six interfaces listed above; Base UI documents `name` as identifying the hidden input included in form submission.

- [ ] **Step 5: Do not commit**

Do not stage or commit generated source. Continue to Task 2 in the same working tree.

### Task 2: Establish the Shared Floating Popup Contract

**Files:**
- Modify: `app/globals.css:94-131`
- Modify: `src/components/ui/select.tsx:SelectContent`, `SelectGroup`, and `SelectItem`
- Modify: `src/components/ui/dropdown-menu.tsx:18-46`, `73-94`, `100-121`, `124-143`
- Test: typecheck and browser popup checks in Task 6

**Interfaces:**
- Consumes: `SelectContent` and `DropdownMenuContent` primitive positioners with `--anchor-width`, `--available-height`, and `--transform-origin`.
- Produces: shared `--floating-popup-*` tokens consumed by both popup implementations.

- [ ] **Step 1: Add the token declarations immediately after the existing `@theme inline` block**

```css
:root {
  --floating-popup-radius: var(--radius-sm);
  --floating-popup-padding: 4px;
  --floating-popup-item-padding-block: 4px;
  --floating-popup-item-padding-inline: 6px;
  --floating-popup-offset: 4px;
  --floating-popup-shadow: var(--shadow-md);
  --floating-popup-transition: 100ms;
}
```

The token values must reference the current theme tokens, not literal color values.

- [ ] **Step 2: Make both primitive positioners use the shared anchor offset**

In both wrappers, keep their existing side defaults but set `sideOffset={0}`. Base UI requires a numeric offset, so consume the shared CSS token on the popup itself instead of duplicating the numeric value. Add these classes to the shared popup class from Step 3:

```tsx
"data-[side=bottom]:mt-(--floating-popup-offset) data-[side=top]:mb-(--floating-popup-offset) data-[side=left]:mr-(--floating-popup-offset) data-[side=right]:ml-(--floating-popup-offset)"
```

Keep the positioner geometry source of truth visible in the class names:

```tsx
className="isolate z-50 outline-none"
```

For `SelectContent`, set `alignItemWithTrigger={false}` so its edge stays anchored below the trigger for keyboard, mouse, and touch rather than taking Base UI's selected-item overlap mode.

- [ ] **Step 3: Replace duplicated popup surface utilities with the token contract**

Apply this popup class shape to `SelectPrimitive.Popup` and `MenuPrimitive.Popup`, retaining `className` as the final `cn` argument so callers can keep local widths:

```tsx
"z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-(--floating-popup-radius) border border-border bg-popover p-(--floating-popup-padding) text-popover-foreground shadow-(--floating-popup-shadow) outline-none transition-[opacity,transform] duration-(--floating-popup-transition) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95"
```

Do not add a raw `z-index`, raw theme color, or `dark:` override beyond the primitives' existing structure.

- [ ] **Step 4: Make Select and dropdown items consume shared density and focus tokens**

For `SelectGroup`, use `p-(--floating-popup-padding)`. For `SelectItem`, and the existing `DropdownMenuItem` and `DropdownMenuSubTrigger`, retain current accessibility and destructive variants while replacing literal `px-1.5 py-1` with:

```tsx
"px-(--floating-popup-item-padding-inline) py-(--floating-popup-item-padding-block) focus:bg-accent focus:text-accent-foreground"
```

Keep `DropdownMenuSubContent` delegated through `DropdownMenuContent`; remove its duplicate surface/padding/shadow/animation utilities so it inherits the shared popup contract, but retain its `w-auto min-w-[96px]` override.

- [ ] **Step 5: Verify the shared contract before migrating consumers**

Run: `rg -n "floating-popup|rounded-lg bg-popover p-1|shadow-md ring-1" "app/globals.css" "src/components/ui/select.tsx" "src/components/ui/dropdown-menu.tsx"`

Expected: all shared geometry, density, elevation, and timing values occur as `--floating-popup-*` declarations or consumers; the old duplicated popup surface sequence has no matches.

- [ ] **Step 6: Do not commit**

Do not stage or commit. Preserve `DropdownMenuContent side="top" className="w-64"` in `app/(protected)/sidebar.tsx` unchanged.

### Task 3: Migrate UTM Preset and Short-Link Domain Forms

**Files:**
- Modify: `app/(protected)/links/link-form.tsx:3-7`, `45-66`
- Modify: `app/(protected)/links/[id]/short-link-form.tsx:3-8`, `30-46`
- Test: browser form-data checks in Task 6

**Interfaces:**
- Consumes: `Select` components from `@/components/ui/select`; `applyPreset(presetId: string): void`; `Domain[]`.
- Produces: unchanged UTM input updates and a `domainId` hidden input emitted by `Select.Root name="domainId"`.

- [ ] **Step 1: Replace the UTM native select with an uncontrolled Base UI Select**

Add this import in `app/(protected)/links/link-form.tsx`:

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

Replace the native element with:

```tsx
<Select defaultValue={null} onValueChange={(value) => value && applyPreset(value)}>
  <SelectTrigger id="preset" className="w-full">
    <SelectValue placeholder="Elige un preajuste…" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      {presets.map((preset) => (
        <SelectItem key={preset.id} value={preset.id}>
          {preset.name}
        </SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

Keep the visible Spanish `<label htmlFor="preset">` and the `sourceRef`, `mediumRef`, `campaignRef`, and `applyPreset` function unchanged.

- [ ] **Step 2: Replace the domain native select with a named Base UI Select**

Add the same Select import in `app/(protected)/links/[id]/short-link-form.tsx`. Replace the native element with:

```tsx
<Select name="domainId" defaultValue={domains[0].id} required>
  <SelectTrigger id="domainId" className="min-w-48">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      {domains.map((domain) => (
        <SelectItem key={domain.id} value={domain.id}>
          {domain.hostname}
        </SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

`name="domainId"` is required: Base UI 1.8.0 emits the selected value through its hidden form input. Do not add a second hidden `domainId` input unless inspecting the rendered `FormData` in Task 6 proves this integration fails.

- [ ] **Step 3: Verify static type safety before continuing**

Run: `pnpm typecheck`

Expected: exits `0`; in particular, no `string | null` error reaches `applyPreset` and `domains[0].id` is accepted after the existing zero-domains guard.

- [ ] **Step 4: Do not commit**

Do not stage or commit. Continue with the QR correction migration.

### Task 4: Migrate Both QR Error-Correction Controls

**Files:**
- Modify: `app/(protected)/qr/static-qr-form.tsx:3-8`, `82-99`
- Modify: `app/(protected)/qr/website-qr-form.tsx:3-8`, `84-101`
- Test: browser controlled-value, disabled-state, preview, and submission checks in Task 6

**Interfaces:**
- Consumes: `errorCorrectionLevel: "L" | "M" | "Q" | "H"`, `setErrorCorrectionLevel`, `logoUrl`, and `useQrPreview`.
- Produces: controlled Base UI Select values with the same `errorCorrectionLevel` form field.

- [ ] **Step 1: Add the shared Select import to both QR forms**

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

- [ ] **Step 2: Replace each native correction select with this controlled composition**

Use `id="staticErrorCorrectionLevel"` in `static-qr-form.tsx` and `id="errorCorrectionLevel"` in `website-qr-form.tsx`:

```tsx
<Select
  name="errorCorrectionLevel"
  value={errorCorrectionLevel}
  disabled={Boolean(logoUrl)}
  onValueChange={(value) => {
    if (value) setErrorCorrectionLevel(value as "L" | "M" | "Q" | "H");
  }}
>
  <SelectTrigger id="staticErrorCorrectionLevel" className="w-full">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectItem value="L">L</SelectItem>
      <SelectItem value="M">M</SelectItem>
      <SelectItem value="Q">Q</SelectItem>
      <SelectItem value="H">H</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

In `website-qr-form.tsx`, substitute `errorCorrectionLevel` for both `id` values. Keep the existing label `htmlFor` target, state union, `useQrPreview` argument, logo hidden input, and all Spanish text unchanged.

- [ ] **Step 3: Verify the controlled union remains local and form submission remains named**

Run: `rg -n "name=\"errorCorrectionLevel\"|value=\{errorCorrectionLevel\}|setErrorCorrectionLevel\(value as \"L\" \| \"M\" \| \"Q\" \| \"H\"\)|disabled=\{Boolean\(logoUrl\)\}" "app/(protected)/qr/static-qr-form.tsx" "app/(protected)/qr/website-qr-form.tsx"`

Expected: each file has all four matches exactly once.

- [ ] **Step 4: Do not commit**

Do not stage or commit. Continue with filters and analytics.

### Task 5: Migrate QR Filters and Analytics Granularity

**Files:**
- Modify: `app/(protected)/qr/qr-list.tsx:3-12`, `70-88`
- Modify: `app/(protected)/analytics/[linkId]/scans-panel.tsx:3-9`, `85-94`
- Test: browser filtering and refetch checks in Task 6

**Interfaces:**
- Consumes: `StatusFilter`, `TypeFilter`, `ScanGranularity`, their setters, and the existing analytics effect dependency array.
- Produces: controlled Selects whose values stay within the existing type aliases.

- [ ] **Step 1: Add the Select import to both client components**

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

- [ ] **Step 2: Replace the QR status filter with this controlled composition**

```tsx
<Select
  value={statusFilter}
  onValueChange={(value) => {
    if (value) setStatusFilter(value as StatusFilter);
  }}
>
  <SelectTrigger aria-label="Filtrar por estado">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectItem value="all">Todos los estados</SelectItem>
      <SelectItem value="active">Activo</SelectItem>
      <SelectItem value="archived">Archivado</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

- [ ] **Step 3: Replace the QR type filter with this controlled composition**

```tsx
<Select
  value={typeFilter}
  onValueChange={(value) => {
    if (value) setTypeFilter(value as TypeFilter);
  }}
>
  <SelectTrigger aria-label="Filtrar por tipo">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectItem value="all">Todos los tipos</SelectItem>
      <SelectItem value="dynamic">Sitio web</SelectItem>
      <SelectItem value="static">Texto fijo</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

- [ ] **Step 4: Replace analytics granularity with this controlled composition**

```tsx
<Select
  value={granularity}
  onValueChange={(value) => {
    if (value) setGranularity(value as ScanGranularity);
  }}
>
  <SelectTrigger aria-label="Granularidad de escaneos">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectItem value="day">Día</SelectItem>
      <SelectItem value="week">Semana</SelectItem>
      <SelectItem value="month">Mes</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

Do not alter `useEffect` or its dependency array `[linkId, granularity, from, to]`.

- [ ] **Step 5: Verify all native select hosts are removed and all Select items are grouped**

Run: `rg -n "<select\\b" app; rg -n "<SelectItem" "app/(protected)/links/link-form.tsx" "app/(protected)/links/[id]/short-link-form.tsx" "app/(protected)/qr/static-qr-form.tsx" "app/(protected)/qr/website-qr-form.tsx" "app/(protected)/qr/qr-list.tsx" "app/(protected)/analytics/[linkId]/scans-panel.tsx"`

Expected: the first command returns no matches; every `SelectItem` appears inside a `SelectGroup` in the displayed code.

- [ ] **Step 6: Do not commit**

Do not stage or commit. Continue to complete verification.

### Task 6: Verify Type Safety, Regression Coverage, and Real Interactions

**Files:**
- Modify: none unless a prior task's failure reveals a defect
- Test: existing Vitest suite plus browser verification of all migrated interactive behavior

**Interfaces:**
- Consumes: all outputs from Tasks 1-5.
- Produces: evidence that Select preserves form data, controlled state, keyboard access, popup geometry, and local worktree integrity.

- [ ] **Step 1: Run the existing automated checks**

Run: `pnpm lint; if ($?) { pnpm typecheck }; if ($?) { pnpm test }; if ($?) { pnpm build }`

Expected: every command exits `0`. Do not claim DOM interaction coverage from this suite; the project has no browser test harness.

- [ ] **Step 2: Start the application for browser verification**

Run: `pnpm dev`

Expected: Next.js reports a local development URL. Leave this process running only for the following checks.

- [ ] **Step 3: Verify shared popup treatment in both themes and at mobile width**

At Signature and Midnight themes, open a migrated Select and the sidebar account DropdownMenu. Confirm both use popover surface/foreground, border, compact padding, 100ms scale/fade motion, and no viewport-height overflow. At a 320px viewport, confirm each Select popup has trigger width and stays positioned in the visible viewport; confirm the sidebar account menu remains `w-64` and opens above its trigger.

- [ ] **Step 4: Verify keyboard and disabled interaction behavior**

For every migrated Select, use Tab to focus, Enter and Space to open, Arrow keys to move the highlighted option, Enter to select, Escape to dismiss, and verify focus returns to the trigger. Upload or select a QR logo in both QR creation modes; verify `errorCorrectionLevel` is visibly disabled, cannot open, and remains in the submitted form data.

- [ ] **Step 5: Verify behavior and form-data preservation for each migration unit**

Use browser DevTools or an intercepted form submission to confirm:

```text
UTM preset: selecting a preset writes its original utmSource, utmMedium, and utmCampaign into the three editable inputs.
Short link: the initial selected domain is domains[0].id and FormData contains exactly one domainId entry with the selected domain ID.
Static QR: selecting L, M, Q, or H updates the preview and FormData.errorCorrectionLevel.
Website QR: selecting L, M, Q, or H updates the preview and FormData.errorCorrectionLevel.
QR status filter: all, active, and archived update filteredRows without changing labels.
QR type filter: all, dynamic, and static update filteredRows without changing labels.
Analytics: day, week, and month each update granularity and produce a fetch URL containing that exact granularity query parameter.
```

- [ ] **Step 6: Verify the worktree contains only intentional migration changes**

Run: `git diff --check; if ($?) { git status --short }; if ($?) { git diff -- "app/globals.css" "src/components/ui/select.tsx" "src/components/ui/dropdown-menu.tsx" "app/(protected)/links/link-form.tsx" "app/(protected)/links/[id]/short-link-form.tsx" "app/(protected)/qr/static-qr-form.tsx" "app/(protected)/qr/website-qr-form.tsx" "app/(protected)/qr/qr-list.tsx" "app/(protected)/analytics/[linkId]/scans-panel.tsx" }`

Expected: `git diff --check` exits `0`; the diff contains only the intended Select migration and shared popup changes in addition to the pre-existing local edits, which remain intact and unmodified.

- [ ] **Step 7: Do not commit**

Do not run `git add` or `git commit`. A commit is outside this plan unless the user explicitly requests one after reviewing the verified changes.

## Self-Review

### Spec Coverage

- Base UI Select addition and no Watermelon dependency: Task 1.
- Dry-run/diff inspection and no overwrite: Task 1, Steps 1-3.
- Shared token popup surface, geometry, motion, theme behavior, and dropdown retention: Task 2.
- UTM preset, short-link domain, both QR correction hosts, both QR filters, and analytics granularity: Tasks 3-5.
- Form submission, controlled state, Spanish copy, disabled QR correction, preview/filter/refetch behavior, keyboard, focus, Escape, mobile placement, theme checks, and sidebar width: Task 6.
- Preservation of unrelated worktree edits and prohibition on commits: Global Constraints and every task's final step.

### Incomplete-Step Scan

No incomplete or deferred implementation language remains. Every implementation step names an exact path, command, or TSX/CSS composition.

### Type Consistency

- `Select.Root` receives `name`, `required`, `defaultValue`, `value`, `disabled`, and `onValueChange`; these are supported by installed `@base-ui/react` 1.8.0.
- The UTM handler narrows null before calling `applyPreset(presetId: string)`.
- QR correction keeps the exact `"L" | "M" | "Q" | "H"` union in both components.
- QR filters retain `StatusFilter` and `TypeFilter`; analytics retains `ScanGranularity` and its existing fetch dependency.
- `SelectItem` is always nested inside `SelectGroup`, consistent with the shadcn Base UI composition contract.
