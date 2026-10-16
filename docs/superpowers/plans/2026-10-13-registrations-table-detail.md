# Registration Table And Detail Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped registrations list with a wide review table, URL-backed status tabs, and a controlled right-side detail sheet.

**Architecture:** Keep filtering and searching server-rendered through `RegistrationsPage` and its existing `searchParams` contract. Move row selection and table interaction into a focused client component that receives already-filtered registrations, while rendering one controlled `RegistrationDetailSheet` for the selected row. Preserve existing CSV export and companion actions, and make no schema changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, existing `Sheet` primitive, Vitest 5.

## Global Constraints

- The registrations workspace remains ADMIN-only.
- Status tabs and search must preserve URL query parameters.
- No database migration or new dependency is allowed for this change.
- The table must remain usable on mobile through horizontal scrolling.
- The detail sheet must expose current registration, attendee, preference, UTM, pass, and check-in data.
- Existing CSV export and add-companion behavior must remain available.

---

### Task 1: Extract A Reusable Registration Table Model

**Files:**
- Create: `app/(protected)/events/[id]/registrations/registrations-table-model.ts`
- Test: `app/(protected)/events/[id]/registrations/registrations-table-model.test.ts`

**Interfaces:**
- Consumes: `RegistrationWithAttendees` from `@/modules/events` and the existing status labels.
- Produces: pure row-display helpers used by the client table; no React or database imports.

- [ ] **Step 1: Write the failing tests**

Add tests for the pure helpers that keep display rules out of JSX:

```ts
import { describe, expect, it } from "vitest";
import { getPrimaryAttendee, getRegistrationTableValues } from "./registrations-table-model";

const registration = {
  id: "reg-1",
  status: "confirmed",
  createdAt: new Date("2026-10-13T20:44:00.000Z"),
  source: "public",
  clientBrands: ["shades"],
  interests: ["battery-motors", "curtains"],
  requestedMoreCompanions: true,
  utmSource: "instagram",
  attendees: [
    {
      id: "att-1",
      fullName: "María González",
      email: "maria@example.com",
      checkedInAt: null,
      occupation: "architect",
    },
    {
      id: "att-2",
      fullName: "Diego Torres",
      email: "diego@example.com",
      checkedInAt: null,
      occupation: "installer-technician",
    },
  ],
} as never;

describe("registration table model", () => {
  it("uses the first attendee as the primary contact", () => {
    expect(getPrimaryAttendee(registration)?.fullName).toBe("María González");
  });

  it("summarizes the high-value columns without losing detail data", () => {
    expect(getRegistrationTableValues(registration)).toEqual({
      companionCount: 1,
      brands: "Shades",
      interests: "Motores de baterías, Cortinería",
      pass: "Pendiente",
      followUp: true,
      source: "instagram",
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/registrations-table-model.test.ts"`

Expected: FAIL because `registrations-table-model.ts` does not exist yet.

- [ ] **Step 3: Implement the pure model**

Define these exact exports:

```ts
export function getPrimaryAttendee(registration: RegistrationWithAttendees) {
  return registration.attendees[0];
}

export function getRegistrationTableValues(registration: RegistrationWithAttendees) {
  const [primary, ...companions] = registration.attendees;
  return {
    companionCount: companions.length,
    brands: registration.clientBrands.map((value) => BRAND_LABELS[value] ?? value).join(", ") || "—",
    interests: registration.interests.map((value) => INTEREST_LABELS[value] ?? value).join(", ") || "—",
    pass: primary?.checkedInAt ? "Registrado" : "Pendiente",
    followUp: registration.requestedMoreCompanions,
    source: registration.utmSource ?? (registration.source === "admin_added" ? "Admin" : "Directo"),
  };
}
```

Keep the label maps private to this model and reuse the same labels currently used by CSV/detail
views. Do not change registration persistence or server query behavior.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/registrations-table-model.test.ts"`

Expected: PASS.

- [ ] **Step 5: Commit the isolated model**

```bash
git add "app/(protected)/events/[id]/registrations/registrations-table-model.ts" "app/(protected)/events/[id]/registrations/registrations-table-model.test.ts"
git commit -m "refactor(events): extract registration table display model"
```

### Task 2: Build The Wide Interactive Registration Table

**Files:**
- Create: `app/(protected)/events/[id]/registrations/registrations-table.tsx`
- Modify: `app/(protected)/events/[id]/registrations/page.tsx:46-150`
- Test: `app/(protected)/events/[id]/registrations/page.test.tsx`

**Interfaces:**
- Consumes: `registrations`, `eventId`, `collectCompany`, `collectJobTitle`, and status labels from
  the server page; consumes the pure model from Task 1.
- Produces: `RegistrationsTable` client component with a selected registration ID and one detail
  sheet instance.

- [ ] **Step 1: Add the server-page regression test expectation**

Update the page test mock for `RegistrationsTable` and assert the page passes the filtered rows and
event configuration to it. The test must also retain the existing ADMIN/not-found behavior.

```tsx
vi.mock("./registrations-table", () => ({
  RegistrationsTable: (props: { registrations: unknown[]; eventId: string }) => (
    <div data-testid="registrations-table">{props.eventId}:{props.registrations.length}</div>
  ),
}));

it("passes filtered registrations to the interactive table", async () => {
  const result = await RegistrationsPage({
    params: Promise.resolve({ id: "event-1" }),
    searchParams: Promise.resolve({ status: "confirmed", q: "maria" }),
  });

  expect(JSON.stringify(result)).toContain('data-testid="registrations-table"');
});
```

- [ ] **Step 2: Run the page test and verify the new expectation fails**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/page.test.tsx"`

Expected: FAIL because the page still renders the inline table instead of `RegistrationsTable`.

- [ ] **Step 3: Implement the client table shell**

Create `RegistrationsTable` with this shape:

```tsx
"use client";

export function RegistrationsTable({
  registrations,
  eventId,
  collectCompany,
  collectJobTitle,
  statusLabels,
}: {
  registrations: RegistrationWithAttendees[];
  eventId: string;
  collectCompany: boolean;
  collectJobTitle: boolean;
  statusLabels: Record<EventRegistrationRow["status"], string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRegistration = registrations.find(({ id }) => id === selectedId) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[1120px] w-full text-left text-sm">
          {/* columns: contact, status, date, brands, interests, companions, pass, follow-up, source */}
        </table>
      </div>
      {selectedRegistration ? (
        <RegistrationDetailSheet
          registration={selectedRegistration}
          statusLabel={statusLabels[selectedRegistration.status]}
          open
          onOpenChange={(open) => !open && setSelectedId(null)}
          eventId={eventId}
          collectCompany={collectCompany}
          collectJobTitle={collectJobTitle}
        />
      ) : null}
    </>
  );
}
```

Render the full row as a `button`-like accessible target using `tabIndex={0}`, `role="button"`,
`onClick`, and `onKeyDown` for Enter/Space. Keep nested email links and the add-companion action
inside wrappers that call `event.stopPropagation()`.

Use the table model for contact summary and columns. Truncate long brands/interests with CSS while
retaining the complete values in the detail sheet. Use `min-w-[1120px]` and a surrounding
`overflow-x-auto` container instead of allowing every cell to wrap into unreadable columns.

- [ ] **Step 4: Replace the inline table in `RegistrationsPage`**

Keep the existing server-side `listRegistrations` call and pass its result to `RegistrationsTable`.
Delete only the inline `<table>` mapping; preserve the empty state, CSV link, search form, and
status filter links for the next task.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/page.test.tsx" "app/(protected)/events/[id]/registrations/registrations-table-model.test.ts"`

Expected: PASS.

- [ ] **Step 6: Commit the table shell**

```bash
git add "app/(protected)/events/[id]/registrations/registrations-table.tsx" "app/(protected)/events/[id]/registrations/page.tsx" "app/(protected)/events/[id]/registrations/page.test.tsx"
git commit -m "feat(events): add wide interactive registration table"
```

### Task 3: Convert The Detail Sheet To A Controlled Panel

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx:43-133`
- Modify: `app/(protected)/events/[id]/registrations/registrations-table.tsx`

**Interfaces:**
- Consumes: selected registration from `RegistrationsTable`.
- Produces: a controlled `RegistrationDetailSheet` with `open` and `onOpenChange`, rendered from
  the right side and reusable for any selected row.

- [ ] **Step 1: Add the controlled sheet props before changing behavior**

Change the component props to include:

```ts
open: boolean;
onOpenChange: (open: boolean) => void;
eventId: string;
collectCompany: boolean;
collectJobTitle: boolean;
```

Remove the sheet's internal `useState`. Pass `open` and `onOpenChange` to the existing `Sheet`.
Keep the current `SheetContent` primitive and its right-side default.

- [ ] **Step 2: Organize detail content into explicit sections**

Render the following order inside the sheet:

1. Registro: status, timestamp, source, and registration ID.
2. Contacto: primary email, phone, company, job title, and occupation.
3. Preferencias: brands, interests, consent timestamps, and additional-companion request.
4. Asistentes: every attendee with email, optional phone/company/job title/occupation, backup code,
   and check-in state.
5. Origen: all populated UTM values.
6. Acciones: existing `AddCompanionRow` for non-cancelled registrations.

Use consistent section headings, `grid` facts for contact values, and separate attendee blocks. Do
not remove any fields currently displayed by the sheet.

- [ ] **Step 3: Verify controlled open/close behavior**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/page.test.tsx"`

Expected: PASS. Manually verify that clicking a row opens the sheet, clicking close clears the
selection, and clicking a nested email or companion control does not open/close the sheet.

- [ ] **Step 4: Commit the controlled detail panel**

```bash
git add "app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx" "app/(protected)/events/[id]/registrations/registrations-table.tsx"
git commit -m "feat(events): open registration details in a side sheet"
```

### Task 4: Polish Filters, Workspace Width, And Responsive States

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/page.tsx:46-91`
- Modify: `app/(protected)/events/[id]/registrations/registrations-table.tsx`
- Test: `app/(protected)/events/[id]/registrations/page.test.tsx`

**Interfaces:**
- Consumes: existing `status`, `q`, `filterHref`, and CSV export URL behavior.
- Produces: consistent URL-preserving toolbar and responsive table/detail presentation.

- [ ] **Step 1: Preserve filter combinations in tests**

Add assertions that `filterHref` behavior keeps `q` when changing status and that the CSV export
link includes both active parameters:

```ts
expect(serializedPage).toContain("status=confirmed");
expect(serializedPage).toContain("q=maria");
    expect(serializedPage).toContain("registrations/export?status=confirmed&q=maria");
```

Use the existing page test's actual serialized output and adjust the exact assertion to the route's
current URL encoding rather than changing the query contract.

- [ ] **Step 2: Implement the workspace toolbar styling**

Change the page container from `max-w-4xl` to a wide layout suitable for the table. Keep the event
sub-navigation at the top. Group search, active filters, and export into a responsive toolbar:

```tsx
<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
  <form className="flex flex-col gap-2 sm:flex-row sm:items-center">...</form>
  <Link href={exportHref} className="...">Exportar CSV</Link>
</div>
```

Render tabs as a bordered segmented control with a clear active state; keep them links, not client
state, so refresh and back/forward preserve the current result set.

- [ ] **Step 3: Add responsive and empty/loading affordances**

Keep the table in horizontal scroll on mobile, ensure the detail sheet has readable padding and
full-width actions on narrow screens, and style the empty state with the active query/status in
plain language. Do not add a new loading framework or dependency.

- [ ] **Step 4: Run the complete verification suite**

Run: `pnpm check`

Expected: lint passes, typecheck passes, all existing tests plus the table-model tests pass, and the
production build completes.

- [ ] **Step 5: Perform the manual acceptance pass**

Verify in a production-like browser at desktop and mobile widths:

- Tabs switch status without losing the search term.
- CSV export respects the active status and search.
- The table exposes all agreed columns and scrolls horizontally on narrow screens.
- Enter and Space activate a focused row.
- The side sheet opens for each row and displays all available data.
- Email links, add-companion controls, and sheet buttons remain independently clickable.
- Empty results, long names/emails, multiple companions, and missing UTM values remain readable.

- [ ] **Step 6: Commit the polish pass**

```bash
git add "app/(protected)/events/[id]/registrations/page.tsx" "app/(protected)/events/[id]/registrations/registrations-table.tsx" "app/(protected)/events/[id]/registrations/page.test.tsx"
git commit -m "feat(events): polish registration review workspace"
```

## Final Review

- Confirm the implementation matches `docs/superpowers/specs/2026-10-13-registrations-table-detail-design.md`.
- Confirm no migration or schema file changed.
- Confirm the only new client state is selected-row/detail-sheet state.
- Confirm all existing server-side search, status filtering, CSV export, and companion behavior remain intact.
