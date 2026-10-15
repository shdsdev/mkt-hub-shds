# Event Editor Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize event creation and editing into clear internal tabs, with explicit date/time fields that preserve the existing timestamp contract.

**Architecture:** Add a small client-only tabs shell that keeps inactive panels mounted and accessible. The main event fields remain in one server-action form across the first four tabs; integrations render in the fifth tab outside that form because their controls submit independent actions. Extract local date/time conversion into a tested utility so create and edit use the same behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, existing UI primitives, Vitest, Zod, server actions.

## Global Constraints

- Keep the persisted model as `startsAt` and nullable `endsAt` timestamps.
- Keep all fields for the main event save mounted in the DOM while hidden panels are inactive.
- Keep integration actions outside the main event form to avoid nested forms.
- Preserve the existing admin visual language, checkbox behavior, premium controls, and responsive layout.
- No database migration.
- No changes to public event pages or email rendering.
- Do not commit changes unless explicitly requested by the user.

---

### Task 1: Add Shared Local Date/Time Conversion

**Files:**
- Create: `src/lib/events/event-date-time.ts`
- Create: `src/lib/events/event-date-time.test.ts`

**Interfaces:**
- Produces `splitDateTimeLocal(date: Date | null): { date: string; time: string }`.
- Produces `combineDateTimeLocal(date: string, time: string): string`.
- Produces `combineOptionalDateTimeLocal(date: string, time: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { combineDateTimeLocal, combineOptionalDateTimeLocal, splitDateTimeLocal } from "./event-date-time";

describe("event local date/time helpers", () => {
  it("splits a Date into date and time values for native inputs", () => {
    expect(splitDateTimeLocal(new Date(2026, 9, 13, 14, 29))).toEqual({
      date: "2026-10-13",
      time: "14:29",
    });
  });

  it("combines required date and time values into datetime-local format", () => {
    expect(combineDateTimeLocal("2026-10-13", "14:29")).toBe("2026-10-13T14:29");
  });

  it("returns an empty value when the optional end date/time is blank", () => {
    expect(combineOptionalDateTimeLocal("", "")).toBe("");
  });

  it("does not silently accept only one optional end value", () => {
    expect(() => combineOptionalDateTimeLocal("2026-10-13", "")).toThrow(
      "La fecha y hora de finalización deben completarse juntas.",
    );
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run src/lib/events/event-date-time.test.ts`

Expected: FAIL because `src/lib/events/event-date-time.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal helper module**

```ts
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function splitDateTimeLocal(date: Date | null): { date: string; time: string } {
  if (!date) return { date: "", time: "" };
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function combineDateTimeLocal(date: string, time: string): string {
  if (!date || !time) throw new Error("La fecha y hora del evento son obligatorias.");
  return `${date}T${time}`;
}

export function combineOptionalDateTimeLocal(date: string, time: string): string {
  if (!date && !time) return "";
  if (!date || !time) throw new Error("La fecha y hora de finalización deben completarse juntas.");
  return `${date}T${time}`;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run src/lib/events/event-date-time.test.ts`

Expected: 4 tests pass.

### Task 2: Build the Accessible Tabs Shell

**Files:**
- Create: `app/(protected)/events/event-editor-tabs.tsx`
- Create: `app/(protected)/events/event-editor-tabs.test.tsx`

**Interfaces:**
- Produces `EventEditorTabs` with `children` for the tab list/panels and `defaultTab` support.
- Produces `EventEditorTabPanel` with `id`, `active`, and `children` props.
- Uses `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, and `aria-labelledby`.

- [ ] **Step 1: Add a focused component test or DOM-level contract test**

Cover these behaviors:

```tsx
expect(screen.getByRole("tab", { name: "Datos del evento" })).toHaveAttribute("aria-selected", "true");
await user.click(screen.getByRole("tab", { name: "Correos" }));
expect(screen.getByRole("tabpanel", { name: "Correos" })).toBeVisible();
expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
```

The last assertion confirms inactive form controls remain mounted rather than being conditionally removed.

- [ ] **Step 2: Implement keyboard and mouse tab switching**

Use one client state string for the active tab. Keep every panel mounted and toggle visibility with the `hidden` attribute or equivalent CSS. Support `ArrowLeft`, `ArrowRight`, `Home`, and `End` on the tablist, wrapping focus among the five tabs.

- [ ] **Step 3: Run the focused test**

Run: `pnpm vitest run app/(protected)/events/event-editor-tabs.test.tsx`

Expected: the tab accessibility and mounted-panel assertions pass.

### Task 3: Extract the Main Event Form Panels

**Files:**
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx`
- Modify: `app/(protected)/events/event-create-form.tsx`
- Create: `app/(protected)/events/event-basic-fields.tsx`
- Create: `app/(protected)/events/event-landing-fields.tsx`
- Create: `app/(protected)/events/event-registration-fields.tsx`

**Interfaces:**
- `EventBasicFields` receives the current event values for edit or empty defaults for create and renders explicit labels.
- `EventLandingFields` receives `organizationId`, current agenda, sponsor logos, and hero image state.
- `EventRegistrationFields` owns the existing registration config state and hidden JSON fields.

- [ ] **Step 1: Move existing markup without behavior changes**

Move the current name, description, image, agenda, sponsor, registration, and email field groups into focused components. Keep the existing input names (`name`, `slug`, `description`, `location`, `capacity`, `reminderOffsetMinutes`, `heroImageUrl`, `agenda`, `sponsorLogos`, `emailContent`, `registrationFormConfig`, `collectCompany`, and `collectJobTitle`) unchanged.

- [ ] **Step 2: Place the groups into the tabs**

Use this mapping in both create and edit:

```tsx
<EventEditorTabPanel tab="event"> <EventBasicFields /> </EventEditorTabPanel>
<EventEditorTabPanel tab="landing"> <EventLandingFields /> </EventEditorTabPanel>
<EventEditorTabPanel tab="email"> <EventEmailContentFields /> </EventEditorTabPanel>
<EventEditorTabPanel tab="registration"> <EventRegistrationFields /> </EventEditorTabPanel>
```

All four panels must remain inside the same main `<form>` so hidden inputs and state-backed JSON values are submitted together.

- [ ] **Step 3: Preserve save/status/publish/close behavior**

Keep `useActionState`, pending labels, success/error messages, publish action, close confirmation, and their current server actions. The save button remains available after the tab panels so the administrator can save from any tab.

- [ ] **Step 4: Run existing event tests and typecheck**

Run: `pnpm vitest run src/modules/events app/(protected)/events`

Expected: existing event tests pass; any UI test failures must identify a changed accessible label or missing hidden input rather than be bypassed.

### Task 4: Split Date and Time Inputs

**Files:**
- Modify: `app/(protected)/events/event-basic-fields.tsx`
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx`
- Modify: `app/(protected)/events/event-create-form.tsx`
- Test: `src/lib/events/event-date-time.test.ts`

**Interfaces:**
- Visible controls use `startDate`, `startTime`, `endDate`, and `endTime` without replacing the server payload names.
- Hidden controls named `startsAt` and `endsAt` receive the combined values expected by `readEventFields` in `app/(protected)/events/actions.ts`.

- [ ] **Step 1: Render explicit labels and helper text**

Use these labels:

```tsx
Fecha del evento
Hora de inicio
Fecha de finalización (opcional)
Hora de finalización (opcional)
Ubicación del evento (opcional)
```

Add helper text: `Usá la finalización sólo si el evento tiene una hora de cierre definida.`

- [ ] **Step 2: Wire visible state to hidden server fields**

Initialize edit values with `splitDateTimeLocal(event.startsAt)` and `splitDateTimeLocal(event.endsAt)`. Initialize create values empty. Use `combineDateTimeLocal` for `startsAt` and `combineOptionalDateTimeLocal` for `endsAt` before submission. If the optional end date/time is partially filled, stop submission and show an inline error near the end-time controls.

- [ ] **Step 3: Verify create and edit payload compatibility**

Submit a form with `2026-10-13`, `14:29`, `2026-10-13`, and `17:30`; assert the action receives `startsAt=2026-10-13T14:29` and `endsAt=2026-10-13T17:30`. Submit with no end values; assert `endsAt` is empty/omitted. Do not alter `eventFieldsSchema` or the database timestamp columns.

- [ ] **Step 4: Run focused validation**

Run: `pnpm vitest run src/lib/events/event-date-time.test.ts`

Expected: all conversion and optional-end cases pass.

### Task 5: Add Integrations as the Fifth Tab

**Files:**
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx`
- Modify: `app/(protected)/events/[id]/edit/page.tsx`
- Keep unchanged: `app/(protected)/events/[id]/edit/webhook-settings.tsx`
- Keep unchanged: `app/(protected)/events/[id]/edit/embed-settings.tsx`
- Keep unchanged: `app/(protected)/events/[id]/edit/reception-team.tsx`

**Interfaces:**
- `EventEditForm` receives `receptionUsers: ManagedUser[]` and `assignedReceptionistIds: string[]` from `app/(protected)/events/[id]/edit/page.tsx`.
- Webhook, embed, and reception controls retain their existing independent actions and form boundaries.

- [ ] **Step 1: Move the existing integration cards into the Integraciones panel**

Render the three existing components in the fifth panel. Keep the panel outside the main event `<form>` because its internal forms are independent server-action forms and HTML does not permit nested forms.

- [ ] **Step 2: Verify independent actions**

Manually exercise saving the webhook URL, regenerating the webhook secret, copying the embed snippet, assigning a receptionist, and removing a receptionist while the Integraciones tab is active.

- [ ] **Step 3: Verify main save from every tab**

Change one field in each of the first four tabs, switch to another tab, submit the main save action, and confirm all changes are included in one request.

### Task 6: Responsive and Accessibility Verification

**Files:**
- Modify: `app/(protected)/events/event-editor-tabs.tsx`

- [ ] **Step 1: Check desktop composition**

Verify tabs have a visible active state, no label clipping, and the two-column field layout remains readable at desktop width.

- [ ] **Step 2: Check mobile composition**

Verify the tab list can scroll horizontally or wrap without hiding labels, fields collapse to one column, buttons remain reachable, and focus rings are visible.

- [ ] **Step 3: Run the Impeccable detector**

Run:

```powershell
& "C:\Users\javier.enriquez\.agents\skills\impeccable\scripts\impeccable.cmd" detect --json "app/(protected)/events/[id]/edit/event-editor-tabs.tsx" "app/(protected)/events/[id]/edit/event-edit-form.tsx" "app/(protected)/events/event-create-form.tsx" "app/(protected)/events/event-basic-fields.tsx"
```

Expected: no unresolved high-severity UI findings.

### Task 7: Full Verification

**Files:**
- No new files; verify all implementation files from Tasks 1-6.

- [ ] **Step 1: Run lint**

Run: `pnpm lint`

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

- [ ] **Step 3: Run all tests**

Run: `pnpm test`

Expected: all test files and tests pass.

- [ ] **Step 4: Run production build**

Run: `pnpm build`

Expected: Next.js production build completes successfully.

- [ ] **Step 5: Run the combined project check**

Run: `pnpm check`

Expected: lint, typecheck, tests, and build all complete successfully.
