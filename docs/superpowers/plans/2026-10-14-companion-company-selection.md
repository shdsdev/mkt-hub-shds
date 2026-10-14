# Companion Company Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let public companions inherit the titular's company or enter another company, while administrative additions always inherit the titular's current company.

**Architecture:** Keep the existing attendee `company` text field and resolve the final value server-side. The public form owns a two-option mode (`same` or `other`); the public action validates and resolves that mode against the primary attendee. The internal form removes company input from the administrative companion flow and the action copies the primary company from the database.

**Tech Stack:** Next.js App Router, React, TypeScript, server actions, Zod, Drizzle/Supabase-backed events service, Vitest, Tailwind CSS.

## Global Constraints

- Keep `company` as a text value on each attendee.
- Public companion registration exposes exactly two modes: `Misma empresa` and `Otra empresa`.
- `Misma empresa` is selected by default.
- Administrative companion creation always copies the primary attendee's current company.
- Administrative creation ignores any client-provided company value.
- Later primary-company edits do not rewrite existing companion records.
- No company catalog, autocomplete, normalization, or new company table.
- Existing duplicate-email, capacity, permission, and event-state behavior remains unchanged.
- Do not commit or push until explicitly requested.
- Preserve unrelated dirty worktree changes.

---

## File Map

- Modify `app/events/[id]/register-form.tsx` for the public companion mode selector and conditional company input.
- Modify `app/events/[id]/actions.ts` for public server-side company resolution and validation.
- Modify `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx` to remove editable company input from admin additions.
- Modify `app/(protected)/events/[id]/internal-form/actions.ts` to resolve the primary company and ignore client company input.
- Modify existing public action tests and internal action tests for the new validation rules.
- Modify service tests only if the existing domain contract needs a focused assertion for the resolved `company` value.

## Task 1: Public Companion Company UI

**Files:**
- Modify: `app/events/[id]/register-form.tsx`
- Test: existing public registration form test if present; otherwise cover behavior in the public action test from Task 2

**Interfaces:**
- Consumes the existing `formConfig.fields.company` visibility/required configuration and `hasCompanion` state.
- Produces `companionCompanyMode` with value `same` or `other`, plus `companionCompany` only when the alternate mode is selected.

- [ ] **Step 1: Add the mode state and primary-company reference**

Add a controlled state initialized to `same` and derive the primary company from the form with a controlled value or a form-level field reference. Keep the existing primary `company` input name unchanged.

```tsx
const [companionCompanyMode, setCompanionCompanyMode] = useState<"same" | "other">("same");
```

- [ ] **Step 2: Replace the companion company text input**

Replace the current `companionCompany` field block with a labeled fieldset:

```tsx
<fieldset className="flex flex-col gap-2 sm:col-span-2">
  <legend className="text-sm font-medium text-[#4a4a4a]">Empresa del acompañante</legend>
  <div className="flex flex-col gap-2 sm:flex-row">
    <label className="flex items-center gap-2 text-sm text-[#4a4a4a]">
      <input
        type="radio"
        name="companionCompanyMode"
        value="same"
        checked={companionCompanyMode === "same"}
        onChange={() => setCompanionCompanyMode("same")}
      />
      Misma empresa
    </label>
    <label className="flex items-center gap-2 text-sm text-[#4a4a4a]">
      <input
        type="radio"
        name="companionCompanyMode"
        value="other"
        checked={companionCompanyMode === "other"}
        onChange={() => setCompanionCompanyMode("other")}
      />
      Otra empresa
    </label>
  </div>
  {companionCompanyMode === "same" ? (
    <p className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-[#4a4a4a]">
      Se usará la empresa del titular.
    </p>
  ) : (
    <input
      name="companionCompany"
      required
      aria-required="true"
      maxLength={255}
      placeholder="Ej. Estudio Norte"
      className={fieldClass}
    />
  )}
</fieldset>
```

The final implementation must keep the repository's existing checkbox and form styling conventions. When switching back to `same`, clear the alternate value from local state or ensure the server ignores it.

- [ ] **Step 3: Run the public form lint/type checks**

Run: `pnpm eslint "app/events/[id]/register-form.tsx" && pnpm typecheck`

Expected: PASS.

## Task 2: Public Server-Side Resolution

**Files:**
- Modify: `app/events/[id]/actions.ts`
- Test: existing public action test file for `registerForEventAction`

**Interfaces:**
- Consumes `companionCompanyMode` and optional `companionCompany` from `FormData`.
- Produces the existing `RegisterForEventInput` with a resolved `companions[0].company` value and unchanged action result shape.

- [ ] **Step 1: Add failing tests for both public modes**

Add tests following the existing action-test setup:

```ts
it("copies the primary company when the companion chooses the same company", async () => {
  const result = await registerForEventAction({}, formData({
    company: "Nau Studio",
    companionCompanyMode: "same",
    companionCompany: "Forged Company",
  }));

  expect(registerForEventMock).toHaveBeenCalledWith(expect.objectContaining({
    primary: expect.objectContaining({ company: "Nau Studio" }),
    companions: [expect.objectContaining({ company: "Nau Studio" })],
  }));
  expect(result.error).toBeUndefined();
});

it("requires an alternate company when the companion chooses another company", async () => {
  const result = await registerForEventAction({}, formData({
    company: "Nau Studio",
    companionCompanyMode: "other",
    companionCompany: "   ",
  }));

  expect(result.error).toBe("Revisa la empresa del acompañante.");
  expect(registerForEventMock).not.toHaveBeenCalled();
});
```

Add a test that a forged primary-company browser value cannot override the server-resolved titular company, using the existing action mock boundaries.

- [ ] **Step 2: Run the tests and verify the new cases fail**

Run: `pnpm vitest run "app/events/[id]/actions.test.ts"`

Expected: the new company-mode tests fail before the implementation because the action currently treats companion company as a direct text field.

- [ ] **Step 3: Parse and resolve the company server-side**

Use a strict mode parse and resolve the primary company from the same validated primary input already used by the action. Apply this logic before calling the events service:

```ts
const companionCompanyMode = z.enum(["same", "other"]).safeParse(formData.get("companionCompanyMode"));
const primaryCompany = z.string().trim().min(1).max(255).safeParse(formData.get("company"));
if (!primaryCompany.success) return { error: "Revisa los datos de la empresa." };

const rawCompanionCompany = z.string().trim().max(255).safeParse(formData.get("companionCompany") ?? "");
if (!rawCompanionCompany.success) return { error: "Revisa la empresa del acompañante." };

const companionCompany = companionCompanyMode.data === "same"
  ? primaryCompany.data
  : rawCompanionCompany.data;
if (!companionCompany) return { error: "Revisa la empresa del acompañante." };
```

Pass only the resolved `companionCompany` into the existing companion input. Do not add a client-controlled primary-company field or change duplicate-email/capacity handling.

- [ ] **Step 4: Run the public action tests**

Run: `pnpm vitest run "app/events/[id]/actions.test.ts"`

Expected: all existing and new public registration tests PASS.

## Task 3: Administrative Inheritance

**Files:**
- Modify: `app/(protected)/events/[id]/internal-form/internal-registration-form.tsx`
- Modify: `app/(protected)/events/[id]/internal-form/actions.ts`
- Test: `app/(protected)/events/[id]/internal-form/actions.test.ts`

**Interfaces:**
- Consumes the existing searched `RegistrationWithAttendees` and its `attendees[0].company` value.
- Produces an administrative companion creation with the primary company's resolved value and no editable company field.

- [ ] **Step 1: Add a failing administrative inheritance test**

Add a test proving that a submitted forged company is ignored:

```ts
it("uses the titular company when an admin adds a companion", async () => {
  mockSearchRegistration({ primary: { company: "Nau Studio" } });

  await addInternalCompanionAction(formData({ company: "Forged Company" }));

  expect(addAttendeeToRegistrationMock).toHaveBeenCalledWith(expect.objectContaining({
    attendee: expect.objectContaining({ company: "Nau Studio" }),
  }));
});
```

Use the existing authorization and registration fixtures rather than bypassing `requireAdmin`.

- [ ] **Step 2: Run the administrative action test and verify it fails**

Run: `pnpm vitest run "app/(protected)/events/[id]/internal-form/actions.test.ts"`

Expected: FAIL because the current action forwards the submitted company value.

- [ ] **Step 3: Remove the administrative company input**

Remove the `company` Input from the add-companion form in `internal-registration-form.tsx`. Keep the primary attendee company visible in the registration summary so the administrator understands what will be inherited.

- [ ] **Step 4: Resolve the primary company in the server action**

In `addInternalCompanionAction`, use the registration loaded for the selected `registrationId` and set the service payload to:

```ts
const primary = registration.attendees[0];
if (!primary?.company?.trim()) return { error: "El titular no tiene empresa configurada." };

attendee: {
  ...attendee.data,
  company: primary.company,
  phone: attendee.data.phone || undefined,
  jobTitle: attendee.data.jobTitle || undefined,
}
```

Do not read or trust `formData.get("company")`. Preserve the existing admin permission gate, capacity bypass, duplicate-email mapping, audit, revalidation, and success dialog.

- [ ] **Step 5: Run the administrative action tests**

Run: `pnpm vitest run "app/(protected)/events/[id]/internal-form/actions.test.ts"`

Expected: all administrative action tests PASS, including the forged-company case.

## Task 4: Regression Verification

**Files:**
- Modify only files from Tasks 1-3 if a concrete verification failure requires it.

- [ ] **Step 1: Run all affected tests**

Run:

```bash
pnpm vitest run "app/events/[id]/actions.test.ts" "app/(protected)/events/[id]/internal-form/actions.test.ts" "app/(protected)/events/[id]/check-in/page.test.tsx"
```

Expected: all affected test files PASS.

- [ ] **Step 2: Run lint, typecheck, and build**

Run: `pnpm check`

Expected: ESLint, TypeScript, the complete test suite, and the Next.js production build PASS.

- [ ] **Step 3: Inspect the focused diff**

Run:

```bash
git diff -- "app/events/[id]/register-form.tsx" "app/events/[id]/actions.ts" "app/(protected)/events/[id]/internal-form/internal-registration-form.tsx" "app/(protected)/events/[id]/internal-form/actions.ts" "app/events/[id]/actions.test.ts" "app/(protected)/events/[id]/internal-form/actions.test.ts"
```

Expected: only the approved company-selection and inheritance behavior appears; no company catalog, unrelated attendee changes, or access-control changes are introduced.

## Plan Self-Review

- Spec coverage: public two-mode UI and resolution are Tasks 1-2; admin inheritance is Task 3; validation, regressions, and build are Task 4.
- Placeholder scan: all steps include concrete paths, values, commands, expected outputs, or exact implementation rules.
- Type consistency: the public mode is `"same" | "other"`; the resulting service contract remains the existing `company?: string` attendee field.
- Security: both public and admin rules are enforced server-side; browser values cannot override resolved company ownership.
