# HCS Admin Connection Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HCS pairing usable from an ADMIN-only organization settings page while keeping pairing codes and access tokens one-time secrets.

**Architecture:** Keep HCS persistence and token generation in `src/modules/integrations/service.ts`, adding organization-scoped list/revoke/renew methods. Add authenticated server actions under the settings route that derive organization and actor identity from `getCurrentUser`, then render a server-loaded page with a small client form for one-time secret responses.

**Tech Stack:** Next.js 16 server actions/pages, React 19 `useActionState`, Drizzle ORM/PostgreSQL, Zod, Vitest, existing Tailwind/shadcn primitives.

## Global Constraints

- ADMIN actions require an authenticated, active ADMIN profile.
- Pairing code expiry defaults to 15 minutes and connection renewal expiry defaults to 90 days.
- Raw pairing codes and access tokens are returned only by the immediate mutation response and are never persisted or included in list results.
- All HCS connection reads and writes are constrained by the authenticated organization ID.
- Do not add new HCS HTTP renewal/revocation routes.
- Do not commit changes.

---

### Task 1: Lock down service behavior with failing tests

**Files:**
- Modify: `src/modules/integrations/service.test.ts`
- Modify: `app/(protected)/settings/users/actions.test.ts` or create the closest settings action test file if absent

**Interfaces:**
- Service tests define organization-scoped `listHcsConnections`, `revokeHcsConnection`, and `renewHcsConnection` inputs.
- Settings action tests define ADMIN denial, pairing-code generation, revoke, and renew response behavior.

- [ ] **Step 1: Add service tests for organization scoping and one-time secret safety.**
- [ ] **Step 2: Add server-action tests for unauthenticated/inactive/non-ADMIN denial.**
- [ ] **Step 3: Add tests proving generated code/token is returned immediately but only a hash is passed to persistence.**
- [ ] **Step 4: Run the focused tests and confirm they fail for missing behavior, not test setup errors.**

Run: `pnpm vitest run src/modules/integrations/service.test.ts app/(protected)/settings/integrations/actions.test.ts`
Expected: FAIL because the organization-scoped methods/actions do not yet exist.

### Task 2: Implement organization-scoped integration services

**Files:**
- Modify: `src/modules/integrations/service.ts`
- Modify: `src/lib/env.ts` if configurable expiry getters are needed
- Test: `src/modules/integrations/service.test.ts`

**Interfaces:**
- `listHcsConnections(organizationId: string)` returns safe connection metadata only.
- `revokeHcsConnection({ organizationId, connectionId, now? })` updates only a matching organization connection.
- `renewHcsConnection({ organizationId, connectionId, expiresAt, now? })` generates a new token, updates its hash/prefix, and returns `{ connection, accessToken }`.

- [ ] **Step 1: Implement the smallest service changes to satisfy the failing tests.**
- [ ] **Step 2: Ensure renewal preserves `organizationId`, `hcsCompanyId`, and `hcsCompanyName`, and rejects revoked/mismatched connections.**
- [ ] **Step 3: Ensure revoke immediately affects `authenticateHcsToken` through `revokedAt`.**
- [ ] **Step 4: Run service tests and confirm green.**

Run: `pnpm vitest run src/modules/integrations/service.test.ts`
Expected: PASS.

### Task 3: Add ADMIN server actions

**Files:**
- Create: `app/(protected)/settings/integrations/actions.ts`
- Create: `app/(protected)/settings/integrations/actions.test.ts`
- Test: `app/(protected)/settings/integrations/actions.test.ts`

**Interfaces:**
- `generateHcsPairingCodeAction` returns `{ pairingCode, expiresAt }` only on success.
- `revokeHcsConnectionAction` returns a Spanish success/error state.
- `renewHcsConnectionAction` returns `{ accessToken, connection }` only in the immediate response.

- [ ] **Step 1: Define Zod schemas for connection IDs and action form inputs.**
- [ ] **Step 2: Implement shared active-ADMIN authorization using `getCurrentUser`, `isActive`, and `isAdmin`.**
- [ ] **Step 3: Derive 15-minute pairing and 90-day renewal expiry defaults server-side.**
- [ ] **Step 4: Revalidate `/settings/integrations` after revoke/renew.**
- [ ] **Step 5: Run action tests and confirm green.**

Run: `pnpm vitest run 'app/(protected)/settings/integrations/actions.test.ts'`
Expected: PASS.

### Task 4: Build the ADMIN-only settings UI and navigation

**Files:**
- Create: `app/(protected)/settings/integrations/page.tsx`
- Create: `app/(protected)/settings/integrations/hcs-integrations.tsx`
- Modify: `app/(protected)/settings/settings-layout.tsx`
- Test: `app/(protected)/settings/integrations/page.test.tsx` if the project’s page test pattern supports it

**Interfaces:**
- The page rejects non-admin users with `notFound()`, loads only the authenticated organization’s safe connection metadata, and passes it to the client component.
- The client component uses existing `Button`/`Input` patterns and `useActionState`, displays raw secrets only in immediate success feedback, and never receives persisted tokens.

- [ ] **Step 1: Add the ADMIN-only nav item conditionally.**
- [ ] **Step 2: Render pairing generation, one-time code/token callouts, safe connection fields, and revoke/renew controls.**
- [ ] **Step 3: Add responsive overflow handling, keyboard-visible focus, disabled/loading states, and `role="alert"`/`role="status"` feedback.**
- [ ] **Step 4: Run focused UI/action tests and confirm green.**

Run: `pnpm vitest run 'app/(protected)/settings/integrations/**'`
Expected: PASS.

### Task 5: Full verification

**Files:**
- No additional files; inspect the complete diff for secret leakage.

- [ ] **Step 1: Run focused integration and settings tests.**
- [ ] **Step 2: Run `pnpm typecheck`.**
- [ ] **Step 3: Run `pnpm drizzle-kit check` or the repository-supported Drizzle schema check command.**
- [ ] **Step 4: Run `pnpm lint`.**
- [ ] **Step 5: Run `pnpm build`.**
- [ ] **Step 6: Confirm `git status` shows only intended uncommitted changes and no commit is created.**
