# Configurable Event Registration Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-event registration-form configuration, consent and preference capture, one-companion handling, follow-up requests, and iframe auto-resizing without breaking existing events.

**Architecture:** Add a validated JSONB configuration to `events`, with a compatibility fallback derived from the existing `collectCompany` and `collectJobTitle` columns. Persist new registration answers on `event_registrations` as typed JSONB/scalar fields, validate all submitted values server-side against the event configuration, and expose the configuration through the existing event edit and public form paths.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Drizzle ORM, PostgreSQL, Vitest, pnpm.

## Global Constraints

- Keep the supported field catalog fixed; do not create a general-purpose form builder.
- Name and email remain required.
- Phone, company, and job title are configurable per event.
- Privacy and terms consent remain required; marketing consent is optional.
- The public form accepts at most one directly registered companion.
- The server is authoritative for configuration and submitted option validation.
- Existing events without explicit configuration must continue rendering with current behavior.
- Do not add nested scroll containers to the embed.

---

## File Map

- Create: `src/modules/events/registration-form-config.ts` — Zod schema, fixed option catalogs, defaults, and compatibility normalization.
- Modify: `src/modules/events/db.ts` — add the event configuration and registration response columns.
- Modify: `src/modules/events/service.ts` — expose normalized configuration and persist new registration data.
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx` — add the administration controls.
- Modify: `app/(protected)/events/actions.ts` — validate and save configuration.
- Modify: `app/events/[id]/register-form.tsx` — render configured fields and the new public sections.
- Modify: `app/events/[id]/actions.ts` — parse and validate configured submissions.
- Modify: `app/events/embed/[slug]/page.tsx` — render the resize bridge and configured form.
- Create: `app/events/embed/[slug]/resize-bridge.tsx` — measure the iframe document and post height updates.
- Modify: `src/modules/events/embed.ts` — include the safe parent resize listener in copied snippets.
- Modify: `app/(protected)/events/[id]/registrations/page.tsx` — display follow-up and captured answers.
- Modify: `app/(protected)/events/[id]/registrations/csv.ts` — export new registration values.
- Create: `drizzle/0021_configurable_event_registration_form.sql` — add nullable/defaulted additive columns.
- Modify: `src/modules/events/registration-form-config.test.ts`, `src/modules/events/db.test.ts`, `src/modules/events/service.test.ts`, `app/events/[id]/actions.test.ts`, `app/(protected)/events/[id]/registrations/csv.test.ts`, and the event edit/embed/page test files listed in later tasks.

## Interfaces

The shared configuration module must export these stable interfaces:

```typescript
export const registrationFormConfigSchema: z.ZodType<RegistrationFormConfig>;
export type RegistrationFormConfig = {
  version: 1;
  fields: {
    phone: { visible: boolean; required: boolean };
    company: { visible: boolean; required: boolean };
    jobTitle: { visible: boolean; required: boolean };
  };
  companion: { enabled: boolean };
  clientBrands: { enabled: boolean; options: ClientBrandOption[] };
  interests: { enabled: boolean; options: InterestOption[] };
  consent: {
    privacy: { url: string; text: string };
    terms: { url: string; text: string };
    marketing: { enabled: boolean; text: string };
  };
};
export function getDefaultRegistrationFormConfig(event: EventRow): RegistrationFormConfig;
export function resolveRegistrationFormConfig(event: EventRow): RegistrationFormConfig;
```

The registration service input must become:

```typescript
type RegisterForEventInput = {
  eventId: string;
  source?: "public" | "admin_added";
  primary: AttendeeInput;
  companions?: AttendeeInput[];
  clientBrands?: string[];
  interests?: string[];
  requestedMoreCompanions?: boolean;
  consents: {
    privacyAcceptedAt: Date;
    termsAcceptedAt: Date;
    marketingAcceptedAt?: Date;
  };
  utm?: UtmFields;
};
```

### Task 1: Add Configuration Schema and Database Migration

**Files:**
- Create: `src/modules/events/registration-form-config.ts`
- Modify: `src/modules/events/db.ts`
- Modify: `src/modules/events/service.ts`
- Create: `drizzle/0021_configurable_event_registration_form.sql`
- Test: `src/modules/events/registration-form-config.test.ts`
- Test: `src/modules/events/db.test.ts`

**Interfaces:**
- Consumes: `EventRow`, existing `collectCompany`, and existing `collectJobTitle`.
- Produces: `RegistrationFormConfig`, `resolveRegistrationFormConfig(event)`, and event registration fields consumed by Tasks 2–5.

- [ ] **Step 1: Write failing configuration tests.**

```typescript
it("uses compatibility defaults for an event without explicit configuration", () => {
  const config = resolveRegistrationFormConfig({
    registrationFormConfig: null,
    collectCompany: true,
    collectJobTitle: false,
  } as EventRow);

  expect(config.fields.company).toEqual({ visible: true, required: false });
  expect(config.fields.jobTitle).toEqual({ visible: false, required: false });
  expect(config.consent.privacy).toEqual({ url: "/privacy", text: "Acepto la política de privacidad" });
});

it("rejects a required hidden field", () => {
  expect(() => registrationFormConfigSchema.parse({
    ...getDefaultRegistrationFormConfig({} as EventRow),
    fields: { phone: { visible: false, required: true }, company: { visible: false, required: false }, jobTitle: { visible: false, required: false } },
  })).toThrow();
});

it("accepts only fixed client-brand and interest option values", () => {
  expect(() => registrationFormConfigSchema.parse({
    ...getDefaultRegistrationFormConfig({} as EventRow),
    clientBrands: { enabled: true, options: ["shades"] },
    interests: { enabled: true, options: ["cortineria"] },
  })).not.toThrow();
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm vitest run src/modules/events/registration-form-config.test.ts`

Expected: FAIL because the configuration module and exports do not exist.

- [ ] **Step 3: Implement the fixed configuration schema.**

Define the fixed option catalogs for `shades`, `bmighty`, `drapery`, and the four approved interest values. Define defaults with name/email required, optional phone/company/job title disabled unless compatibility columns enable them, one companion disabled, empty option selections, required privacy/terms consent, and optional marketing consent. Parse `registrationFormConfig` when present and otherwise derive compatibility defaults from the existing event columns.

- [ ] **Step 4: Add additive database columns and migration.**

Add `registrationFormConfig` as nullable JSONB on `events`, preserving `collectCompany` and `collectJobTitle`. Add registration columns for `clientBrands` JSONB, `interests` JSONB, `requestedMoreCompanions` boolean defaulting false, and `consents` JSONB. The migration must initialize no historical answers and must not rewrite existing registrations.

- [ ] **Step 5: Extend the service types and registration insert.**

Add the fields from the Interfaces section to `RegisterForEventInput` and insert them with the registration row. Return the existing result shape unchanged apart from the populated row fields.

- [ ] **Step 6: Run focused tests and type checks.**

Run: `pnpm vitest run src/modules/events/registration-form-config.test.ts src/modules/events/db.test.ts src/modules/events/service.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the data-model work.**

```bash
git add src/modules/events/registration-form-config.ts src/modules/events/db.ts src/modules/events/service.ts src/modules/events/registration-form-config.test.ts src/modules/events/db.test.ts src/modules/events/service.test.ts drizzle/0021_configurable_event_registration_form.sql
git commit -m "feat(events): add configurable registration form data"
```

### Task 2: Add Per-Event Administration Controls

**Files:**
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx`
- Modify: `app/(protected)/events/actions.ts`
- Modify: `app/(protected)/events/[id]/edit/page.tsx` to pass the event row, including `registrationFormConfig`, to `EventEditForm`.
- Modify: `app/(protected)/events/actions.test.ts`.

**Interfaces:**
- Consumes: `registrationFormConfigSchema`, `resolveRegistrationFormConfig`, and `EventRow` from Task 1.
- Produces: persisted per-event configuration used by the public form.

- [ ] **Step 1: Write failing action tests for valid and invalid configuration saves.**

```typescript
it("rejects a required field when it is hidden", async () => {
  const result = await updateEventAction(previousState, formDataWith({
    registrationFormConfig: JSON.stringify(configWithHiddenRequiredPhone()),
  }));

  expect(result.error).toContain("teléfono");
});

it("persists the selected brands, interests, and consent copy", async () => {
  const result = await updateEventAction(previousState, formDataWith({
    registrationFormConfig: JSON.stringify(validRegistrationFormConfig),
  }));

  expect(result.success).toBe(true);
  expect(updatedEvent.registrationFormConfig).toEqual(validRegistrationFormConfig);
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm vitest run "app/(protected)/events/actions.test.ts"`

Expected: FAIL because the edit action does not parse or persist the form configuration.

- [ ] **Step 3: Add the administration UI.**

Add a Form Configuration section with Show/Required controls for phone, company, and job title; a locked required display for name/email; the one-companion switch; fixed brand and interest option checkboxes; privacy and terms text/URL inputs; marketing consent switch/text; and a compact preview summary. Disable Required when Show is false and serialize one validated JSON configuration field into the existing event form submission.

- [ ] **Step 4: Validate and persist the configuration in the server action.**

Parse the submitted JSON with `registrationFormConfigSchema`, return a field-specific error for invalid combinations or invalid URLs, update `events.registrationFormConfig`, and revalidate the event edit and public event paths. Keep existing collection columns unchanged for compatibility.

- [ ] **Step 5: Run focused tests and the check command.**

Run: `pnpm vitest run "app/(protected)/events/actions.test.ts"`

Expected: PASS.

Run: `pnpm check`

Expected: PASS with no TypeScript, lint, or test failures.

- [ ] **Step 6: Commit the administration work.**

```bash
git add "app/(protected)/events/[id]/edit/event-edit-form.tsx" "app/(protected)/events/actions.ts" "app/(protected)/events/[id]/edit/page.tsx" "app/(protected)/events/actions.test.ts"
git commit -m "feat(events): configure registration fields per event"
```

### Task 3: Implement Public Rendering and Server Validation

**Files:**
- Modify: `app/events/[id]/register-form.tsx`
- Modify: `app/events/[id]/actions.ts`
- Modify: `src/modules/events/service.ts`
- Test: `app/events/[id]/actions.test.ts`
- Create: `app/events/[id]/register-form.test.tsx`

**Interfaces:**
- Consumes: `resolveRegistrationFormConfig(event)` and the Task 1 registration input.
- Produces: configured public rendering and an authoritative `RegisterFormState` error/success flow.

- [ ] **Step 1: Write failing action tests for configuration enforcement.**

```typescript
it("rejects a missing required consent", async () => {
  const result = await registerForEventAction(initialState, formDataWithout("privacyAccepted"));
  expect(result.error).toBe("Acepta la política de privacidad para continuar.");
});

it("rejects a disabled interest submitted by a tampered client", async () => {
  const result = await registerForEventAction(initialState, formDataWithInterest("disabled-interest"));
  expect(result.error).toBe("Revisa tus intereses seleccionados.");
});

it("rejects more than one companion", async () => {
  const result = await registerForEventAction(initialState, formDataWithTwoCompanions());
  expect(result.error).toBe("Solo puedes registrar un acompañante.");
});
```

- [ ] **Step 2: Run the focused action tests and verify they fail.**

Run: `pnpm vitest run "app/events/[id]/actions.test.ts"`

Expected: FAIL because the action currently accepts multiple companions and does not parse consents or configured options.

- [ ] **Step 3: Add configured sections to `RegisterForm`.**

Render only fields and options enabled by the resolved event configuration. Use one companion row, a separate request-more-companions checkbox, red required dots, `aria-required`, accessible checkbox groups for brands/interests, linked privacy and terms labels, and optional marketing consent. Preserve existing hidden UTM and honeypot inputs.

- [ ] **Step 4: Extend server parsing and validation.**

Resolve the configuration from the server-loaded event, parse optional attendee fields according to visibility/required rules, enforce one companion, parse selected brands/interests, require privacy and terms acceptance, record consent timestamps, and reject any option not enabled for the event before calling `registerForEvent`.

- [ ] **Step 5: Pass all new registration values to the service.**

Populate `clientBrands`, `interests`, `requestedMoreCompanions`, and the consent timestamps in `RegisterForEventInput`. Preserve the current duplicate-email, honeypot, webhook, confirmation-email, and waitlist behavior.

- [ ] **Step 6: Add rendering tests and run focused verification.**

Test that hidden fields are absent, required fields expose the marker and `aria-required`, one companion is rendered, the follow-up checkbox is present, options are rendered only when enabled, and privacy/terms links use the configured URLs.

Run: `pnpm vitest run "app/events/[id]/actions.test.ts" "app/events/[id]/register-form.test.tsx"`

Expected: PASS.

- [ ] **Step 7: Commit the public form work.**

```bash
git add "app/events/[id]/register-form.tsx" "app/events/[id]/actions.ts" "app/events/[id]/actions.test.ts" "app/events/[id]/register-form.test.tsx" src/modules/events/service.ts
git commit -m "feat(events): validate configurable public registration form"
```

### Task 4: Expose Follow-Up Data in Administration and CSV

**Files:**
- Modify: `app/(protected)/events/[id]/registrations/page.tsx`
- Modify: `app/(protected)/events/[id]/registrations/csv.ts`
- Modify: `app/(protected)/events/[id]/registrations/csv.test.ts`
- Modify: `app/(protected)/events/[id]/registrations/page.test.tsx`

**Interfaces:**
- Consumes: persisted registration fields from Task 1.
- Produces: visible follow-up status and exportable preferences/consents.

- [ ] **Step 1: Write failing CSV and page tests.**

```typescript
it("exports follow-up, brands, interests, and consent status", () => {
  const csv = buildRegistrationsCsv([registration({
    requestedMoreCompanions: true,
    clientBrands: ["shades"],
    interests: ["cortineria"],
    consents: { privacyAcceptedAt: new Date("2026-10-13T10:00:00Z"), termsAcceptedAt: new Date("2026-10-13T10:00:00Z") },
  })]);

  expect(csv).toContain("solicita_mas_acompanantes");
  expect(csv).toContain("Shades");
  expect(csv).toContain("Cortinería");
});
```

- [ ] **Step 2: Run focused tests and verify they fail.**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/csv.test.ts" "app/(protected)/events/[id]/registrations/page.test.tsx"`

Expected: FAIL because the new fields are absent from the CSV and registrations UI.

- [ ] **Step 3: Add administration indicators and fields.**

Show a clear follow-up badge for registrations requesting more companions, display selected brands/interests, and show consent timestamps without exposing raw JSON. Keep existing registration actions unchanged.

- [ ] **Step 4: Extend CSV headers and serialization.**

Add stable Spanish headers for follow-up, brands, interests, privacy consent, terms consent, and marketing consent. Serialize arrays as comma-separated display labels and empty optional values as empty cells. Preserve existing column order before appending new columns.

- [ ] **Step 5: Run focused tests and commit.**

Run: `pnpm vitest run "app/(protected)/events/[id]/registrations/csv.test.ts" "app/(protected)/events/[id]/registrations/page.test.tsx"`

Expected: PASS.

```bash
git add "app/(protected)/events/[id]/registrations/page.tsx" "app/(protected)/events/[id]/registrations/csv.ts" "app/(protected)/events/[id]/registrations/csv.test.ts" "app/(protected)/events/[id]/registrations/page.test.tsx"
git commit -m "feat(events): expose registration follow-up data"
```

### Task 5: Remove Embed Double Scroll and Add Height Messaging

**Files:**
- Modify: `app/events/embed/[slug]/page.tsx`
- Create: `app/events/embed/[slug]/resize-bridge.tsx`
- Modify: `src/modules/events/embed.ts`
- Test: `app/events/embed/[slug]/page.test.tsx`

**Interfaces:**
- Consumes: configured public form from Task 3.
- Produces: an embed document that grows to content height and a safe parent resize protocol.

- [ ] **Step 1: Write a failing embed sizing test.**

```typescript
it("posts height changes to the parent using the configured origin", () => {
  render(<EmbedPage event={publishedEvent} parentOrigin="https://shmx.men" />);
  resizeObserverCallback([{ contentRect: { height: 812 } }]);
  expect(window.parent.postMessage).toHaveBeenCalledWith(
    { type: "event-registration:resize", height: 812 },
    "https://shmx.men",
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm vitest run "app/events/embed/[slug]/page.test.tsx"`

Expected: FAIL because no resize protocol exists.

- [ ] **Step 3: Implement the resize protocol and layout rules.**

Remove inner `overflow`/fixed-height scrolling from the embed shell. Measure the document or form root with `ResizeObserver`, post `{ type: "event-registration:resize", height }` to `window.parent`, and retain a minimum fallback height. The generated host snippet must add a `message` listener that accepts only this message type, only from the embed origin, and only from the iframe element that owns the listener. Reject non-positive and unreasonable heights.

- [ ] **Step 4: Run focused and responsive verification.**

Run: `pnpm vitest run "app/events/embed/[slug]/page.test.tsx"`

Expected: PASS.

Manually verify the embed at desktop and mobile widths: one browser scrollbar at most, no inner form scrollbar, and correct height after validation errors and after expanding the companion section.

- [ ] **Step 5: Commit the embed work.**

```bash
git add "app/events/embed/[slug]/page.tsx" "app/events/embed/[slug]/resize-bridge.tsx" src/modules/events/embed.ts "app/events/embed/[slug]/page.test.tsx"
git commit -m "fix(events): resize registration embed without nested scroll"
```

### Task 6: Full Verification and Documentation Check

**Files:**
- Verify all files changed by Tasks 1–5.
- Modify: `docs/superpowers/specs/2026-10-13-event-registration-form-design.md` only if implementation reveals a concrete approved-design correction.

- [ ] **Step 1: Run the complete check suite.**

Run: `pnpm check`

Expected: PASS with all existing and new tests passing.

- [ ] **Step 2: Review the migration and generated schema state.**

Run: `pnpm db:migrate` against the configured development database, then inspect the migration journal and query the new columns to verify that `0021_configurable_event_registration_form.sql` ran exactly once and existing registration rows retain their prior values.

- [ ] **Step 3: Verify the critical journeys.**

Verify an existing event with no JSON configuration, an event with company/job title enabled, an event with one companion, a registration requesting more companions, invalid consent, tampered options, and the mobile embed resize behavior.

- [ ] **Step 4: Inspect the final diff.**

Run: `git status --short` and `git diff --stat master...HEAD`.

Expected: only the intended source, migration, test, and documentation files are included; unrelated worktree files remain untouched.

## Self-Review

- Spec coverage: configuration storage and compatibility are covered by Task 1; administration by Task 2; public rendering, validation, and persistence by Task 3; follow-up visibility and CSV by Task 4; double-scroll behavior by Task 5; regression verification by Task 6.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step is required by this plan.
- Type consistency: `RegistrationFormConfig` and `RegisterForEventInput` are defined before later tasks consume them; all later task references use those names.
- Scope: the plan does not add arbitrary fields, automated outreach, or a generic form-builder subsystem.
