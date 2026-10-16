# Registration Activity and Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required professional-activity select for attendees, preserve job title as a separate field, enforce a mutually exclusive `Ninguno` brand option, and move the additional-companions request into the companion block.

**Architecture:** Add a nullable `occupation` column to `event_attendees` and thread it through `AttendeeInput`, server parsing, registration inserts, detail views, and CSV export. Extend the fixed registration option catalog with `none`, validate brand exclusivity in the shared configuration/action layer, and keep companion UI state limited to one directly registered companion.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Drizzle ORM, PostgreSQL, Vitest, pnpm.

## Global Constraints

- Keep the existing **Puesto** field separate and independently configurable.
- The primary activity field is always required.
- Companion activity is required whenever a companion is present.
- The activity options are exactly Distribuidor/a, Fabricante, Arquitecto/a, Decorador/a, and Instalador/a o técnico/a.
- `Ninguno` is mutually exclusive with Shades, BMighty, and Drapery.
- A request for more companions remains a follow-up flag and never creates extra attendee rows.
- Existing attendee rows remain valid with nullable occupation during migration.
- The directly registered companion limit remains one.

---

## File Map

- Modify: `src/modules/events/db.ts` — add nullable `occupation` to `event_attendees`.
- Modify: `src/modules/events/registration-form-config.ts` — add `none` brand option and exclusivity validation.
- Modify: `src/modules/events/service.ts` — add occupation to attendee inputs and inserts.
- Modify: `src/modules/events/index.ts` — export the fixed occupation options for UI and action code.
- Modify: `app/events/[id]/actions.ts` — parse, validate, normalize, and persist occupation and brand exclusivity.
- Modify: `app/events/[id]/register-form.tsx` — render activity selects, brand None behavior, and repositioned follow-up checkbox.
- Modify: `app/(protected)/events/[id]/registrations/actions.ts` — validate activity when an admin adds a companion.
- Modify: `app/(protected)/events/[id]/registrations/add-companion-row.tsx` — render the required activity select for admin-added companions.
- Modify: `app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx` — show activity.
- Modify: `app/(protected)/events/[id]/registrations/csv.ts` — append primary/companion activity columns.
- Modify: affected action, service, CSV, and page tests.
- Create via Drizzle: `drizzle/0022_*.sql` and `drizzle/meta/0022_snapshot.json` — migration and journal metadata.

## Interfaces

```typescript
export const OCCUPATION_OPTIONS = [
  "distributor",
  "manufacturer",
  "architect",
  "decorator",
  "installer-technician",
] as const;

export type OccupationOption = (typeof OCCUPATION_OPTIONS)[number];

type AttendeeInput = {
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  occupation: OccupationOption;
};
```

### Task 1: Add the Occupation Data Contract and Migration

**Files:**
- Modify: `src/modules/events/db.ts`
- Modify: `src/modules/events/registration-form-config.ts`
- Modify: `src/modules/events/service.ts`
- Modify: `src/modules/events/index.ts`
- Modify: `app/(protected)/events/[id]/registrations/actions.ts`
- Modify: `app/(protected)/events/[id]/registrations/add-companion-row.tsx`
- Test: `src/modules/events/db.test.ts`
- Test: `src/modules/events/service.test.ts`
- Test: `app/(protected)/events/[id]/registrations/actions.test.ts`

**Interfaces:**
- Consumes: existing `eventAttendees`, `AttendeeInput`, and fixed registration option catalog.
- Produces: nullable persisted `occupation` and typed fixed option values for Tasks 2–4.

- [ ] **Step 1: Write failing service and option tests.**

```typescript
it("accepts each fixed occupation option and persists it on the attendee", async () => {
  const result = await registerForEvent({
    eventId: "event-1",
    primary: { fullName: "Ada Lovelace", email: "ada@example.com", occupation: "architect" },
    consents: { privacyAcceptedAt: new Date(), termsAcceptedAt: new Date() },
  });

  expect(result.ok).toBe(true);
  expect(insertedAttendee.occupation).toBe("architect");
});

it("allows none as a brand option but rejects it with another brand", () => {
  expect(() => registrationFormConfigSchema.parse({
    ...validConfig,
    clientBrands: { enabled: true, options: ["none"] },
  })).not.toThrow();

  expect(() => registrationFormConfigSchema.parse({
    ...validConfig,
    clientBrands: { enabled: true, options: ["none", "shades"] },
  })).toThrow();
});
```

- [ ] **Step 2: Run focused tests and verify the new assertions fail.**

Run: `pnpm vitest run src/modules/events/db.test.ts src/modules/events/service.test.ts src/modules/events/registration-form-config.test.ts`

Expected: FAIL because `occupation` and the `none` option do not exist.

- [ ] **Step 3: Add fixed occupation constants and `none` brand validation.**

Add the five stable values and map them to Spanish labels only at presentation boundaries. Extend `CLIENT_BRAND_OPTIONS` with `none` and add a schema refinement that rejects `none` combined with another option. Keep existing brands valid together when `none` is absent.

- [ ] **Step 4: Add the nullable attendee column.**

Add `occupation: text("occupation")` to `eventAttendees`. Keep `jobTitle` unchanged and nullable. Generate the migration from the schema instead of creating SQL manually:

```bash
pnpm db:generate
```

Expected: a new `drizzle/0022_*.sql` plus `drizzle/meta/0022_snapshot.json` and a journal entry. The SQL must add only the nullable `occupation` column.

- [ ] **Step 5: Thread occupation through service types and inserts.**

Add required `occupation` to `AttendeeInput` and insert it for primary and companion attendees. Update the admin add-companion action and row form to collect the same required fixed occupation option. Update service and admin action fixtures to provide explicit occupation values.

- [ ] **Step 6: Apply and verify the migration locally.**

Run: `pnpm db:migrate`

Expected: the local database records the new migration and `event_attendees.occupation` exists as nullable.

- [ ] **Step 7: Run focused tests and commit the data contract.**

Run: `pnpm vitest run src/modules/events/db.test.ts src/modules/events/service.test.ts src/modules/events/registration-form-config.test.ts`

Expected: PASS.

```bash
git add src/modules/events/db.ts src/modules/events/registration-form-config.ts src/modules/events/service.ts src/modules/events/index.ts src/modules/events/db.test.ts src/modules/events/service.test.ts "app/(protected)/events/[id]/registrations/actions.ts" "app/(protected)/events/[id]/registrations/add-companion-row.tsx" "app/(protected)/events/[id]/registrations/actions.test.ts" drizzle/0022_*.sql drizzle/meta/0022_snapshot.json drizzle/meta/_journal.json
git commit -m "feat(events): add attendee occupation data"
```

### Task 2: Implement Public Form Rendering and Server Validation

**Files:**
- Modify: `app/events/[id]/register-form.tsx`
- Modify: `app/events/[id]/actions.ts`
- Modify: `app/events/[id]/actions.test.ts`

**Interfaces:**
- Consumes: `OCCUPATION_OPTIONS`, `OccupationOption`, `AttendeeInput`, and brand exclusivity from Task 1.
- Produces: required primary/companion activity and normalized brand/follow-up payloads.

- [ ] **Step 1: Write failing action tests.**

```typescript
it("rejects a missing primary occupation", async () => {
  const result = await registerForEventAction({}, baseFormData({ occupation: "" }));
  expect(result.error).toContain("actividad profesional");
  expect(mocks.registerForEvent).not.toHaveBeenCalled();
});

it("rejects a missing companion occupation", async () => {
  const form = baseFormData({ occupation: "architect" });
  form.append("companionFullName", "Alan Turing");
  form.append("companionEmail", "alan@example.com");

  const result = await registerForEventAction({}, form);
  expect(result.error).toContain("actividad del acompañante");
});

it("rejects none combined with a brand", async () => {
  const form = baseFormData({ occupation: "architect" });
  form.append("clientBrands", "none");
  form.append("clientBrands", "shades");

  const result = await registerForEventAction({}, form);
  expect(result.error).toBe("Seleccioná una sola opción: Ninguno o una marca.");
});
```

- [ ] **Step 2: Run the focused action test and verify it fails.**

Run: `pnpm vitest run "app/events/[id]/actions.test.ts"`

Expected: FAIL because occupation is not read or validated.

- [ ] **Step 3: Add the required primary activity select.**

Render the label **¿A qué te dedicás profesionalmente?**, helper text **Seleccioná la opción que mejor describe tu actividad.**, and a required native select named `occupation`. Keep the existing `Puesto` input and its configuration separate.

- [ ] **Step 4: Add the companion activity select and reposition follow-up.**

Inside the `hasCompanion` block, render `companionOccupation` as a required select labeled **¿A qué se dedica tu acompañante?**. Move the **Quiero agregar más acompañantes** checkbox into this block below the companion fields. Keep the one-companion limit and remove behavior unchanged.

- [ ] **Step 5: Add None brand behavior.**

Render `none` as **Ninguno**. When checking `none`, clear all other brand checkboxes; when checking a brand, clear `none`. Use controlled state for the selected brand values while keeping the existing `clientBrands` repeated-input names.

- [ ] **Step 6: Parse and validate new fields server-side.**

Read `occupation` and `companionOccupation`, validate both against `OCCUPATION_OPTIONS`, reject missing values with explicit messages, normalize them into `AttendeeInput`, and pass them to `registerForEvent`. Reject unknown activity values and invalid None/brand combinations even if the client is tampered with.

- [ ] **Step 7: Run focused tests and static checks.**

Run: `pnpm vitest run "app/events/[id]/actions.test.ts"`

Expected: PASS.

Run: `pnpm lint && pnpm typecheck`

Expected: PASS.

- [ ] **Step 8: Commit the public form behavior.**

```bash
git add "app/events/[id]/register-form.tsx" "app/events/[id]/actions.ts" "app/events/[id]/actions.test.ts"
git commit -m "feat(events): collect attendee activity and brand choice"
```

### Task 3: Expose Activity in Administration and CSV

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/actions.ts`
- Modify: `app/(protected)/events/[id]/registrations/add-companion-row.tsx`
- Test: `app/(protected)/events/[id]/registrations/actions.test.ts`
- Modify: `app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx`
- Modify: `app/(protected)/events/[id]/registrations/csv.ts`
- Modify: `app/(protected)/events/[id]/registrations/csv.test.ts`

**Interfaces:**
- Consumes: nullable `EventAttendeeRow.occupation` from Task 1 and the fixed occupation options.
- Produces: human-readable activity in detail and appended CSV columns.

- [ ] **Step 1: Write failing detail/CSV assertions.**

```typescript
it("exports primary and companion occupation without changing existing columns", () => {
  const csv = buildRegistrationsCsv([registration({
    attendees: [
      { ...primaryAttendee, occupation: "architect" },
      { ...companionAttendee, occupation: "installer-technician" },
    ],
  })]);

  expect(csv).toContain("Arquitecto/a");
  expect(csv).toContain("Instalador/a o técnico/a");
  expect(csv.split("\r\n")[0]).toContain("actividad_principal");
});
```

- [ ] **Step 2: Run focused tests and verify they fail.**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/csv.test.ts" "app/(protected)/events/[id]/registrations/page.test.tsx"`

Expected: FAIL because occupation is not rendered or exported.

- [ ] **Step 3: Add activity labels to the detail sheet.**

Show `Actividad: Arquitecto/a` or the matching label inside each attendee card. Do not replace the existing `Puesto` line.

- [ ] **Step 4: Add activity to admin-added companion flow.**

Render the same required select in `AddCompanionRow`, parse it in `addCompanionAction`, reject unknown or missing values, and pass it through `addAttendeeToRegistration`. Keep the existing admin permission and duplicate-email checks unchanged.

- [ ] **Step 5: Append activity columns to CSV.**

Keep all existing headers and columns in the same order, then append `actividad_principal` and `actividad_acompanante`. Serialize nullable historical occupation as an empty cell and map stable values to the approved Spanish labels.

- [ ] **Step 6: Run focused tests and commit.**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/csv.test.ts" "app/(protected)/events/[id]/registrations/page.test.tsx"`

Expected: PASS.

```bash
git add "app/(protected)/events/[id]/registrations/registration-detail-sheet.tsx" "app/(protected)/events/[id]/registrations/csv.ts" "app/(protected)/events/[id]/registrations/csv.test.ts"
git commit -m "feat(events): report attendee activity"
```

### Task 4: Full Verification

**Files:**
- Verify all files changed by Tasks 1–3.

- [ ] **Step 1: Run the full check suite.**

Run: `pnpm check`

Expected: lint, typecheck, all tests, and production build pass.

- [ ] **Step 2: Verify the migration and critical flows.**

Run: `pnpm db:migrate`

Then verify manually that the primary activity is required, the companion activity is required when expanded, the checkbox appears below companion fields, None clears other brands, brand-plus-None is rejected server-side, and existing job title remains independent.

## Self-Review

- Spec coverage: persistence/migration is covered by Task 1; public UI and server validation by Task 2; reporting by Task 3; regression verification by Task 4.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step remains.
- Type consistency: `OccupationOption`, `occupation`, and companion parsing names are defined before later tasks consume them.
- Scope: no arbitrary activity values, new admin toggle, second companion, or job-title replacement is introduced.
