# Event Form Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended for inline execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned event-specific form builder with premium controls, custom primary-attendee answers, review status, and response visibility in detail, table, and exports.

**Architecture:** Extend the event registration configuration with stable, versioned custom field definitions. Store custom answers with a submission snapshot so historical responses survive schema edits. Reuse one renderer for the protected preview, public landing form, and embed while retaining existing fixed attendee columns and operational registration states.

**Tech Stack:** Next.js 16.3.4, React 19, TypeScript, Drizzle ORM/PostgreSQL, Zod, `@base-ui/react/select`, Tailwind CSS, Vitest.

## Global Constraints

- Forms are event-scoped only; do not create a standalone forms module.
- Custom fields apply only to the primary attendee in this release.
- Preserve the existing checkbox animation and visual states.
- Use the existing premium `@base-ui/react/select` primitive; do not replace it with native selects.
- Validate all public custom values server-side.
- Keep operational registration status separate from administrative review status.
- Preserve existing consent, UTM, companion, webhook, email, embed, and capacity behavior.

---

### Task 1: Formalize the Versioned Form Schema

**Files:**
- Modify: `src/modules/events/registration-form-config.ts`
- Test: `src/modules/events/registration-form-config.test.ts`

**Interfaces:**
- Produces `RegistrationCustomField`, `RegistrationCustomFieldType`, `RegistrationFormConfig.version`, `RegistrationFormConfig.customFields`, and `RegistrationFormConfigSchema` for all later tasks.

- [ ] **Step 1: Add failing schema tests**

Add tests for stable field IDs, all nine field types, select options, optional checkbox links, duplicate-ID rejection, required-disabled rejection, and migration of the current fixed configuration into an empty custom-field list.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run src/modules/events/registration-form-config.test.ts`

Expected: FAIL because the new schema types and validation do not exist.

- [ ] **Step 3: Implement the schema**

Add a versioned custom field schema with explicit discriminated types, bounded labels/help text, stable IDs, ordered positions, options for single/multiple select, min/max for numbers, and an optional validated URL/text pair for checkbox links. Extend defaults and resolution without changing legacy fixed-field semantics.

- [ ] **Step 4: Run the focused test**

Run: `pnpm vitest run src/modules/events/registration-form-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the schema unit**

Run: `git add src/modules/events/registration-form-config.ts src/modules/events/registration-form-config.test.ts && git commit -m "feat: add versioned event form fields"`

### Task 2: Persist Custom Answers and Review Status

**Files:**
- Modify: `src/modules/events/db.ts`
- Create: `drizzle/0040_event_form_answers_review_status.sql`
- Test: `src/modules/events/db.test.ts`

**Interfaces:**
- Produces `event_registrations.customFormAnswers`, `event_registrations.formVersion`, `event_registrations.reviewStatus`, `event_registrations.reviewedAt`, and `event_registrations.reviewedBy`.

- [ ] **Step 1: Add failing database contract tests**

Assert the registration table exposes JSONB custom answers, a form-version integer, a review-status enum/default, and reviewer metadata without removing existing columns.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run src/modules/events/db.test.ts`

Expected: FAIL because the columns and migration do not exist.

- [ ] **Step 3: Implement the additive schema migration**

Add a PostgreSQL review-status enum defaulting to `new`, JSONB answers defaulting to an empty object, a non-null form version defaulting to `1`, nullable reviewer/timestamp columns, and the matching Drizzle definitions. Preserve organization and event scoping.

- [ ] **Step 4: Run schema tests**

Run: `pnpm vitest run src/modules/events/db.test.ts`

Expected: PASS.

- [ ] **Step 5: Generate/check migration metadata**

Run: `pnpm drizzle-kit generate`

Expected: no destructive drop statements and a migration containing only additive form-answer/review-status changes. Keep the generated migration if the repository's migration workflow requires it; otherwise retain the explicit migration with the project naming convention.

- [ ] **Step 6: Commit the persistence unit**

Run: `git add src/modules/events/db.ts src/modules/events/db.test.ts drizzle/0040_event_form_answers_review_status.sql && git commit -m "feat: persist event form answers and review status"`

### Task 3: Build Shared Field Rendering and Premium Consent Controls

**Files:**
- Create: `src/components/registration-field-renderer.tsx`
- Modify: `src/components/checkbox.tsx`
- Modify: `src/components/ui/select.tsx`
- Create: `src/components/registration-field-renderer.test.tsx`

**Interfaces:**
- Produces `RegistrationFieldRenderer` accepting a field definition and controlled/uncontrolled form props.
- Produces rich checkbox labels with optional links while preserving the `.check`/`.ck-10` animation classes.

- [ ] **Step 1: Add failing renderer tests**

Test that each field type renders the expected semantic input, multiple select renders repeatable checkbox values, required state is exposed to assistive technology, and checkbox links render as links without swallowing checkbox interaction.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run src/components/registration-field-renderer.test.tsx`

Expected: FAIL because the shared renderer does not exist.

- [ ] **Step 3: Implement the renderer**

Use the existing `Select` for single selection, the existing checkbox styling for multiple selection and checkbox fields, and standard semantic inputs for text/number/email/phone/date. Keep stable `name` values based on `fieldId` and render inline label/help/error content.

- [ ] **Step 4: Extend the checkbox component**

Allow a React label node or link-aware label props while retaining the current keyboard behavior, animation classes, disabled state, and visible focus treatment. Do not communicate required state by color alone.

- [ ] **Step 5: Refine the shared select states**

Preserve Base UI behavior while adding the approved premium trigger, hover, selected, disabled, invalid, focus, portal, and mobile sizing states. Do not change the public API used by existing callers.

- [ ] **Step 6: Run focused tests and lint**

Run: `pnpm vitest run src/components/registration-field-renderer.test.tsx && pnpm eslint src/components/checkbox.tsx src/components/ui/select.tsx src/components/registration-field-renderer.tsx`

Expected: PASS with no lint errors.

- [ ] **Step 7: Commit the renderer unit**

Run: `git add src/components/registration-field-renderer.tsx src/components/registration-field-renderer.test.tsx src/components/checkbox.tsx src/components/ui/select.tsx && git commit -m "feat: add shared event registration field renderer"`

### Task 4: Add Builder State and Server Save Action

**Files:**
- Modify: `app/(protected)/events/event-registration-fields.tsx`
- Modify: `app/(protected)/events/actions.ts`
- Modify: `app/(protected)/events/event-create-form.tsx`
- Test: `app/(protected)/events/event-registration-fields.test.tsx`

**Interfaces:**
- Produces a builder state based on `RegistrationFormConfig.customFields`.
- Produces a server action that receives `registrationFormConfig` and rejects invalid versions, IDs, types, options, and links before updating the event.

- [ ] **Step 1: Add failing builder tests**

Test add, edit, duplicate, delete, enable/disable, reorder, required toggling, option editing, and checkbox-link editing. Assert fixed fields remain present and custom fields remain ordered.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run "app/(protected)/events/event-registration-fields.test.tsx"`

Expected: FAIL because the builder controls do not exist.

- [ ] **Step 3: Implement builder state operations**

Add small local operations for field creation, replacement, deletion, movement, duplication, and option updates. Keep the component focused on editing state and delegate rendering to the shared field renderer for preview.

- [ ] **Step 4: Implement the server-side save validation**

Parse the submitted JSON with the shared Zod schema, load the event within the current user's organization, reject invalid configurations without changing the existing valid configuration, and revalidate the event edit and public event paths after success.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run "app/(protected)/events/event-registration-fields.test.tsx" src/modules/events/registration-form-config.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the builder unit**

Run: `git add "app/(protected)/events/event-registration-fields.tsx" "app/(protected)/events/event-registration-fields.test.tsx" "app/(protected)/events/actions.ts" "app/(protected)/events/event-create-form.tsx" && git commit -m "feat: add event registration form builder"`

### Task 5: Validate and Store Public Custom Answers

**Files:**
- Modify: `app/events/[id]/actions.ts`
- Modify: `src/modules/events/service.ts`
- Modify: `app/events/[id]/register-form.tsx`
- Test: `app/events/[id]/actions.test.ts`
- Test: `src/modules/events/service.test.ts`

**Interfaces:**
- Produces server validation for custom answers and passes `{ formVersion, customFormAnswers }` into `registerForEvent`.

- [ ] **Step 1: Add failing submission tests**

Cover valid text/number/date values, single and multiple selections, required failures, invalid options, duplicate multiple selections, disabled fields, unknown field IDs, and a valid submission that remains `confirmed` or `waitlisted` according to existing capacity rules.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run "app/events/[id]/actions.test.ts" src/modules/events/service.test.ts`

Expected: FAIL because custom fields are not rendered, parsed, or stored.

- [ ] **Step 3: Render active custom fields in the public form**

Resolve the event schema and render enabled custom fields after fixed attendee fields and before consent. Use the shared renderer and preserve the existing companion and consent sections.

- [ ] **Step 4: Add server validation and normalization**

Read the active schema server-side, normalize values by type, enforce required fields and option membership, reject unknown/tampered values, and build a metadata snapshot for every submitted custom field.

- [ ] **Step 5: Store the snapshot in the registration transaction**

Extend `RegisterForEventInput` and the insert values in `registerForEvent` to persist form version and custom answers without changing capacity, duplicate-email, consent, UTM, or attendee behavior.

- [ ] **Step 6: Run focused tests**

Run: `pnpm vitest run "app/events/[id]/actions.test.ts" src/modules/events/service.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the public submission unit**

Run: `git add "app/events/[id]/actions.ts" "app/events/[id]/register-form.tsx" "app/events/[id]/actions.test.ts" src/modules/events/service.ts src/modules/events/service.test.ts && git commit -m "feat: collect custom event form answers"`

### Task 6: Apply the Shared Renderer to the Embed and Internal Preview

**Files:**
- Modify: `app/events/embed/[slug]/page.tsx`
- Modify: `app/(protected)/events/event-registration-fields.tsx`
- Modify: `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx`
- Test: `app/events/[id]/page.test.tsx`

- [ ] **Step 1: Add failing integration assertions**

Assert the embed resolves the same active schema as the public landing form and that the protected preview includes premium selects, multiple-select checkboxes, links, required markers, and validation states.

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run "app/events/[id]/page.test.tsx"`

Expected: FAIL for dynamic field rendering or missing schema plumbing.

- [ ] **Step 3: Wire the shared renderer into both paths**

Pass the resolved event form schema into the embed and protected preview. Preserve embed resize messaging and existing event shell behavior.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm vitest run "app/events/[id]/page.test.tsx" && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the integration unit**

Run: `git add "app/events/embed/[slug]/page.tsx" "app/(protected)/events/event-registration-fields.tsx" "app/(protected)/events/[id]/internal-form/internal-registration-form.tsx" "app/events/[id]/page.test.tsx" && git commit -m "feat: share event form rendering with embed"`

### Task 7: Add Review Status Management

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/actions.ts`
- Modify: `app/(protected)/events/[id]/registrations/registrations-table.tsx`
- Modify: `app/(protected)/events/[id]/registrations/page.tsx`
- Create: `app/(protected)/events/[id]/registrations/review-status.ts`
- Test: `app/(protected)/events/[id]/registrations/actions.test.ts`

- [ ] **Step 1: Add failing review-status tests**

Cover permission checks, valid transitions, invalid status rejection, reviewer/timestamp updates, organization scoping, and filter behavior.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/actions.test.ts"`

Expected: FAIL because the review status action and UI do not exist.

- [ ] **Step 3: Implement the status action**

Validate event and registration IDs, require an authorized active admin/reception role according to the existing event access policy, update review status and reviewer metadata, and revalidate the registrations path.

- [ ] **Step 4: Add table filter and status control**

Render a text-labeled review badge/control, filter registrations by review status, and preserve the existing operational status presentation.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/actions.test.ts"`

Expected: PASS.

- [ ] **Step 6: Commit the review-status unit**

Run: `git add "app/(protected)/events/[id]/registrations/actions.ts" "app/(protected)/events/[id]/registrations/registrations-table.tsx" "app/(protected)/events/[id]/registrations/page.tsx" "app/(protected)/events/[id]/registrations/review-status.ts" "app/(protected)/events/[id]/registrations/actions.test.ts" && git commit -m "feat: add event registration review status"`

### Task 8: Display and Export Custom Answers

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/registrations-table.tsx`
- Modify: `app/(protected)/events/[id]/registrations/page.tsx`
- Modify: `app/(protected)/events/[id]/registrations/csv.ts`
- Test: `app/(protected)/events/[id]/registrations/csv.test.ts`

- [ ] **Step 1: Add failing presentation/export tests**

Assert custom answers use historical labels, missing values remain blank, multiple values export predictably, and each known field becomes a stable CSV column.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/csv.test.ts"`

Expected: FAIL because custom answers are not included.

- [ ] **Step 3: Add compact table and detail rendering**

Show a compact summary in the table and the complete field/value list in the registration detail without exposing raw JSON to users.

- [ ] **Step 4: Extend CSV/Excel export**

Build columns from the union of field snapshots present in the exported registrations, use historical labels, serialize multiple values with a deterministic separator, and include review status.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/csv.test.ts"`

Expected: PASS.

- [ ] **Step 6: Commit the reporting unit**

Run: `git add "app/(protected)/events/[id]/registrations/registrations-table.tsx" "app/(protected)/events/[id]/registrations/page.tsx" "app/(protected)/events/[id]/registrations/csv.ts" "app/(protected)/events/[id]/registrations/csv.test.ts" && git commit -m "feat: show custom answers in registrations and exports"`

### Task 9: Full Verification and Accessibility Review

**Files:**
- Modify: any files needed to resolve verification failures only.

- [ ] **Step 1: Run focused event tests**

Run: `pnpm test -- src/modules/events app/events app/(protected)/events`

Expected: all event tests pass.

- [ ] **Step 2: Run static checks**

Run: `pnpm lint && pnpm typecheck`

Expected: no lint or type errors.

- [ ] **Step 3: Run the production build**

Run: `pnpm build`

Expected: production build completes successfully.

- [ ] **Step 4: Verify responsive and keyboard states**

Exercise the builder, public form, and embed at desktop/mobile widths. Verify keyboard traversal for select, multiple select, linked checkbox labels, errors, disabled fields, and submit pending state.

- [ ] **Step 5: Commit verification fixes**

Run: `git add <only-files-fixed-by-verification> && git commit -m "fix: harden event form builder verification"`

Expected: only if verification required a correction; otherwise do not create an empty commit.

## Self-Review

- The design requirements map to Tasks 1-8: schema, persistence, renderer, builder, public submission, embed, review state, and reporting.
- Legacy fixed fields and operational statuses remain covered in Tasks 1, 2, and 5.
- Premium dropdown and checkbox requirements are covered in Task 3 and integration-tested in Task 6.
- Historical response preservation is covered in Tasks 2, 5, and 8.
- No standalone forms, conditional logic, uploads, or advanced analytics are introduced.
- No placeholders or undefined interfaces are used in the task boundaries.
