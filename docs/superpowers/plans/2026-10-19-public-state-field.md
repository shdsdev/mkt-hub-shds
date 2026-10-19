# Public State Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a configurable public `Estado` dropdown for Mexican states, persist it on the primary attendee, expose it in registrations/CSV, and compact checkbox presentation.

**Architecture:** Treat `state` as a nullable first-class attendee column. The public server action owns configuration-aware validation; internal admin registration flows do not render or populate the field. The fixed state catalog lives beside the registration form schema and is reused by UI and validation.

**Tech Stack:** Next.js, React, TypeScript, Zod, Drizzle ORM, PostgreSQL, Vitest, Tailwind CSS.

## Global Constraints

- The field is public-only; internal registration forms remain unchanged.
- Existing event configs must resolve with `state: { visible: false, required: false }`.
- `state` is nullable for compatibility with existing and internal registrations.
- The state dropdown is single-select and uses the project's existing premium Select component.
- Checkbox animation, focus, keyboard access, disabled state, and checked state must remain intact.
- Do not modify unrelated `.atl` files.

### Task 1: Add attendee persistence

**Files:**
- Modify: `src/modules/events/db.ts`
- Modify: `src/modules/events/service.ts`
- Create: `drizzle/0042_public_attendee_state.sql`
- Test: `src/modules/events/service.test.ts`

- [ ] Add `state: text("state")` after `occupation` in `eventAttendees`.
- [ ] Extend `AttendeeInput` with `state?: string`.
- [ ] Include `state` in the primary attendee insert performed by `registerForEvent`.
- [ ] Leave `addAttendeeToRegistration` and `updatePrimaryAttendee` unchanged for internal flows unless TypeScript requires a type-only extension; they must default to `NULL` when no state is supplied.
- [ ] Add a service test asserting a public registration writes `primary.state` and companions do not inherit it.
- [ ] Add migration `ALTER TABLE "event_attendees" ADD COLUMN "state" text;`.
- [ ] Run `pnpm vitest run src/modules/events/service.test.ts --maxWorkers=1` and expect the new test to pass.

### Task 2: Validate public state input

**Files:**
- Modify: `app/events/[id]/actions.ts`
- Modify: `app/events/[id]/register-form.tsx`
- Test: `app/events/[id]/actions.test.ts` or the existing action test file

- [ ] Add `state` to `PUBLIC_FORM_KEYS`.
- [ ] Add optional state parsing to `attendeeSchema` as `z.string().trim().max(100).optional().or(z.literal(""))`.
- [ ] Import `MEXICAN_STATES` and derive a set of accepted values.
- [ ] When the resolved public config has `fields.state.visible`, accept the submitted value; otherwise normalize it to `undefined`.
- [ ] When `fields.state.required` is true, reject an empty state with a field error and the existing invalid-form response.
- [ ] Reject values not present in `MEXICAN_STATES` regardless of visibility.
- [ ] Pass `state` through `normalizeAttendee` into `registerForEvent`.
- [ ] Add tests for hidden, optional, required, and invalid state submissions.
- [ ] Run the focused action tests and confirm red tests turn green.

### Task 3: Render and configure the public field

**Files:**
- Modify: `app/(protected)/events/event-registration-fields.tsx`
- Modify: `app/events/[id]/register-form.tsx`
- Modify: `src/modules/events/registration-form-config.ts`
- Test: `src/modules/events/registration-form-config.test.ts`

- [ ] Extend the admin `RegistrationField` union with `state`.
- [ ] Add `Estado` to the configurable field rows using the same `updateField` behavior as phone/company/job title.
- [ ] Render the field only when `config.fields.state.visible` is true.
- [ ] Render the project's Select with placeholder `Seleccioná tu estado` and one `SelectItem` per `MEXICAN_STATES` entry.
- [ ] Mark the Select required when configured; preserve the existing mobile layout and inline validation styling.
- [ ] Add a config test proving `state` can be visible and required after parsing.
- [ ] Run the config tests and the relevant component tests.

### Task 4: Expose state in registrations and export

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/registrations-table-model.ts`
- Modify: `app/(protected)/events/[id]/registrations/registrations-table.tsx`
- Modify: `app/(protected)/events/[id]/registrations/csv.ts`
- Test: `app/(protected)/events/[id]/registrations/registrations-table-model.test.ts`
- Test: `app/(protected)/events/[id]/registrations/csv.test.ts`

- [ ] Add the primary attendee's nullable state to the table model output.
- [ ] Render a `Estado` column with `Sin indicar` for null values; do not infer a value from companions.
- [ ] Add `estado` to `BASE_HEADERS` and export the primary attendee's raw state label/value.
- [ ] Add model and CSV tests for a populated state and a null state.
- [ ] Run the focused table and CSV tests.

### Task 5: Compact checkbox layout without behavior changes

**Files:**
- Modify: `src/components/checkbox.tsx`
- Modify: `app/events/[id]/register-form.tsx`
- Modify: `app/(protected)/events/event-registration-fields.tsx`
- Test: existing checkbox/component tests if present

- [ ] Keep the native checkbox input, `tabIndex`, `onChange`, `disabled`, `required`, animation classes, and accessible label.
- [ ] Remove only decorative borders, backgrounds, card wrappers, or excessive padding around checkbox groups.
- [ ] Use compact flex rows with `gap-2`/`gap-3` and allow labels to wrap on narrow screens.
- [ ] Verify visible focus, checked animation, disabled styling, and keyboard interaction remain present.
- [ ] Run relevant component tests and inspect the final diff for accidental style regressions.

### Task 6: Full verification

**Files:**
- No additional source files.

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm vitest run --passWithNoTests --maxWorkers=4`.
- [ ] Run `pnpm build`.
- [ ] Run `git diff --check`.
- [ ] Confirm only intended application, migration, test, and documentation files are changed; leave unrelated `.atl` changes untouched.
