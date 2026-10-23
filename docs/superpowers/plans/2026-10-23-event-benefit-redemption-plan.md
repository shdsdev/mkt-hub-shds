# Event Benefit Redemption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Add configurable, auditable gift/discount redemption to the existing event check-in flow while reusing all issued QR and backup codes.

**Architecture:** Keep redemption rules in `src/modules/events` behind dedicated service functions and database constraints. Add separate server actions for event-benefit management and redemption, and compose a second operational card beside the existing check-in card. Use event-scoped capability checks so ADMIN, EVENT_EDITOR, and assigned RECEPTION can operate the scanner while only ADMIN and EVENT_EDITOR manage configuration or annulments.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle ORM, PostgreSQL, Vitest, existing Base UI/Tailwind components.

## Global Constraints

- Existing QR/pass payloads and backup codes must remain unchanged.
- Redemption requires a confirmed check-in and never mutates check-in timestamps.
- One active benefit per effective subject: attendee or registration.
- Redemption scope locks after the first redemption, including after annulment.
- Capped stock must be protected atomically under concurrent redemption requests.
- Preserve existing checkbox animations, premium dropdowns, keyboard focus, loading/error states, and responsive layout.
- Do not modify unrelated worktree changes in `.atl/`, `.codex/`, or the existing email-marketing spec.
- Do not apply migrations, commit, or push until verification is complete and the user explicitly authorizes the operation.

---

### Task 1: Add database enums, event settings, benefits, and redemption tables

**Files:**
- Modify: `src/modules/events/db.ts`
- Create: `drizzle/<generated-name>.sql` using the repository's normal migration generator
- Test: `src/modules/events/db.test.ts`

**Interfaces:**
- Produces `benefitRedemptionScope`, `eventBenefits`, and `eventBenefitRedemptions` schema exports for later service tasks.

- [ ] **Step 1: Write failing schema tests**

Add assertions that the schema exposes the scope enum, event settings, benefit kind/status enums, benefit table, redemption table, and event foreign keys.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test src/modules/events/db.test.ts`

Expected: FAIL because the new schema exports and columns do not exist.

- [ ] **Step 3: Implement the minimal Drizzle schema**

Add nullable event columns for scope and first-redemption timestamp. Add event-scoped benefits with kind-specific nullable fields, quantity, active flag, and timestamps. Add redemption rows with attendee/registration references, actor, status, annulment metadata, and partial unique indexes for active attendee-scope and registration-scope rows.

- [ ] **Step 4: Generate the migration without applying it**

Run the repository's existing migration-generation command from `package.json`, inspect the generated SQL, and confirm it contains no destructive changes to existing pass/check-in columns.

- [ ] **Step 5: Run schema tests**

Run: `pnpm test src/modules/events/db.test.ts`

Expected: PASS.

### Task 2: Add benefit domain validation and redemption service

**Files:**
- Modify: `src/modules/events/service.ts`
- Modify: `src/modules/events/index.ts`
- Test: `src/modules/events/service.test.ts`

**Interfaces:**
- Produces typed benefit inputs/results and service functions for listing, saving, looking up, redeeming, and annulling benefits.

- [ ] **Step 1: Write failing service tests**

Cover gift/discount validation, check-in requirement, duplicate active redemption, attendee versus registration scope, first-redemption scope lock, capped stock, and annulment releasing stock. Use the existing service test database setup and real transactions where available.

- [ ] **Step 2: Run focused tests and verify expected failures**

Run: `pnpm test src/modules/events/service.test.ts`

Expected: FAIL on missing service exports or unmet behavior.

- [ ] **Step 3: Implement validation and lookup**

Add kind-specific validation, stock calculation from active redemptions, effective-subject resolution, and lookup results that include attendee, registration, check-in state, current redemption, and available active benefits.

- [ ] **Step 4: Implement atomic redeem and annul operations**

Use a transaction to re-read the attendee, verify `checkedInAt`, resolve scope, lock or conditionally decrement capped stock, reject an active subject redemption, insert the redemption, and set the event start timestamp only on the first successful redemption. Annulment must mark history, record actor/reason, and make the stock available again.

- [ ] **Step 5: Run focused tests and refactor only after green**

Run: `pnpm test src/modules/events/service.test.ts`

Expected: PASS with no unrelated regressions.

### Task 3: Add capability and server actions for configuration and redemption

**Files:**
- Modify: `src/modules/events/access-policy.ts`
- Modify: `app/(protected)/events/[id]/check-in/actions.ts`
- Create: `app/(protected)/events/[id]/benefits/actions.ts`
- Modify: `src/modules/events/index.ts` if additional exports are needed
- Test: `src/modules/events/access.test.ts`
- Test: `app/(protected)/events/[id]/check-in/actions.test.ts`

**Interfaces:**
- Adds an event capability for benefit operation/configuration.
- Adds server actions for lookup/redeem in the check-in page and dedicated manager actions for benefit catalog/history/annulment.

- [ ] **Step 1: Write failing permission and action tests**

Verify assigned reception can operate redemption, unassigned reception cannot, editor/admin can configure and annul, and unrelated roles are rejected. Verify action responses preserve explicit messages for missing check-in, duplicate redemption, exhausted stock, and unauthorized access.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `pnpm test src/modules/events/access.test.ts app/(protected)/events/[id]/check-in/actions.test.ts`

Expected: FAIL for the missing capability/actions.

- [ ] **Step 3: Add capability policy**

Add separate `benefit-redemption` and `benefit-management` capabilities. Allow ADMIN and EVENT_EDITOR for both; allow assigned RECEPTION only for redemption operation.

- [ ] **Step 4: Implement redemption actions**

Add validated lookup and redeem actions that use the existing code semantics (`passToken` versus 8-character backup code), call the service, and write audit entries for successful redemption and annulment.

- [ ] **Step 5: Implement benefit-management actions**

Add create/update/deactivate/delete-safe, scope-update, and annul actions. Require ADMIN or EVENT_EDITOR through the new capability and require a non-empty annulment reason.

- [ ] **Step 6: Run focused tests**

Run: `pnpm test src/modules/events/access.test.ts app/(protected)/events/[id]/check-in/actions.test.ts`

Expected: PASS.

### Task 4: Add the event editor benefits configuration UI

**Files:**
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx`
- Modify: `app/(protected)/events/[id]/edit/page.tsx`
- Create: `app/(protected)/events/[id]/edit/event-benefits-editor.tsx`
- Create: `app/(protected)/events/[id]/edit/event-benefits-editor.test.tsx`

**Interfaces:**
- Consumes benefit list and management actions from Task 3.
- Produces a `Beneficios` editor tab for ADMIN and EVENT_EDITOR with scope lock, catalog editing, stock, and annulment history.

- [ ] **Step 1: Write failing component tests**

Cover scope selection, gift versus discount fields, unlimited versus capped stock, locked scope after first redemption, remaining stock display, and required annulment reason.

- [ ] **Step 2: Run focused UI tests and verify failures**

Run: `pnpm test app/(protected)/events/[id]/edit/event-benefits-editor.test.tsx`

Expected: FAIL because the component and tab do not exist.

- [ ] **Step 3: Implement the editor with existing controls**

Use the repository's established Button, Input, Select, and checkbox components. Keep fields labeled, preserve focus states, prevent invalid kind-specific submission, and show text status for stock and locked configuration.

- [ ] **Step 4: Wire server data and tab access**

Load benefits and redemption history in the edit page, pass them to the component, and add the tab without broadening existing `updateEventAction` permissions. Hide management UI when the user lacks the management capability.

- [ ] **Step 5: Run focused UI tests**

Run: `pnpm test app/(protected)/events/[id]/edit/event-benefits-editor.test.tsx`

Expected: PASS.

### Task 5: Add the dual operational validation cards

**Files:**
- Modify: `app/(protected)/events/[id]/check-in/page.tsx`
- Modify: `app/(protected)/events/[id]/check-in/check-in-form.tsx`
- Create: `app/(protected)/events/[id]/check-in/benefit-redemption-form.tsx`
- Create: `app/(protected)/events/[id]/check-in/benefit-redemption-form.test.tsx`
- Modify: `app/(protected)/events/[id]/check-in/qr-scanner.tsx` only if scanner ownership needs a shared coordinator
- Test: `app/(protected)/events/[id]/check-in/page.test.tsx`

**Interfaces:**
- Keeps access validation behavior intact.
- Adds a benefit card using the same QR/manual code semantics and a shared one-active-camera coordinator.

- [ ] **Step 1: Write failing UI tests**

Cover both cards on desktop, stacked mobile structure, manual entry, check-in precondition, already redeemed state, benefit selection, stock display, success state, and scanner exclusivity.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `pnpm test app/(protected)/events/[id]/check-in/benefit-redemption-form.test.tsx app/(protected)/events/[id]/check-in/page.test.tsx`

Expected: FAIL because the second card and coordinator do not exist.

- [ ] **Step 3: Implement the benefit card**

Reuse the existing scanner and manual dialog patterns. Render explicit text states, disable actions during requests, require a selected active benefit, and confirm redemption before calling the server action.

- [ ] **Step 4: Compose the two cards responsively**

Use a two-column desktop grid and one-column mobile layout. Coordinate scanner activation so opening one scanner closes or disables the other, while preserving keyboard focus restoration and camera cleanup.

- [ ] **Step 5: Run focused UI tests**

Run: `pnpm test app/(protected)/events/[id]/check-in/benefit-redemption-form.test.tsx app/(protected)/events/[id]/check-in/page.test.tsx`

Expected: PASS.

### Task 6: Full verification and review

**Files:**
- Modify only files identified by failing verification.

- [ ] **Step 1: Run the complete test suite**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 2: Run static checks**

Run: `pnpm lint`

Run: `pnpm typecheck`

Expected: both exit successfully.

- [ ] **Step 3: Build the application**

Run: `pnpm build`

Expected: production build exits successfully.

- [ ] **Step 4: Inspect the final diff and worktree**

Run: `git diff --check`

Run: `git status --short`

Confirm no unrelated `.atl/`, `.codex/`, or pre-existing documentation changes were altered.
