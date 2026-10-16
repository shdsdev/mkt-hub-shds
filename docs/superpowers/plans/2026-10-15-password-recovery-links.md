# Password Recovery Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let invited users request a fresh password setup link from login and let active organization admins send the same link from Settings > Users.

**Architecture:** Reuse Supabase `resetPasswordForEmail` for existing Auth identities instead of attempting to resend an invitation. Both entry points use the existing `/auth/callback` and `/password-setup` flow; the callback preserves only a safe relative destination and the login page exposes an explicit recovery form.

**Tech Stack:** Next.js 16 App Router, React 19 server actions, Supabase SSR/Auth JS, Zod, Vitest, Tailwind UI components.

## Global Constraints

- Never expose service-role credentials to client code.
- Do not call `inviteUserByEmail` as a resend fallback for an existing identity.
- Recovery requests must return a generic result and not reveal whether an email exists.
- Preserve existing form controls, loading states, and responsive behavior.
- Require at least 12 characters for the password setup form.

---

### Task 1: Add Login Password Recovery Action

**Files:**
- Create: `app/login/recovery-actions.ts`
- Create: `app/login/recovery-actions.test.ts`

**Interfaces:**
- Produces `requestPasswordRecovery(_state, formData): Promise<PasswordRecoveryFormState>`.
- Returns `{ success: string }` for valid requests and the same generic success for unknown emails.

- [ ] **Step 1: Write the failing tests**

Test valid email redirect and malformed email handling. Mock the server Supabase client and request headers; assert `resetPasswordForEmail` receives `https://shmx.men/auth/callback?next=%2Fpassword-setup` and does not expose provider errors.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test app/login/recovery-actions.test.ts`

Expected: FAIL because the recovery action does not exist.

- [ ] **Step 3: Implement the minimal server action**

Validate the email with Zod, derive the HTTPS origin from `host` and `x-forwarded-proto`, call `resetPasswordForEmail`, and return the generic success message for both provider success and failure.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm test app/login/recovery-actions.test.ts`

Expected: PASS.

### Task 2: Make the Callback Recovery-Aware

**Files:**
- Modify: `app/auth/callback/route.ts`
- Modify: `app/auth/callback/route.test.ts`

**Interfaces:**
- `GET` accepts `next` and redirects to it only when it starts with `/`.
- Invalid or expired exchanges redirect to `/login?error=invitation` without exposing provider tokens.

- [ ] **Step 1: Add failing callback tests**

Add a test proving `?code=code-1&next=/password-setup` redirects to `/password-setup`, and a test proving an unsafe absolute `next=https://evil.example` falls back to `/password-setup`.

- [ ] **Step 2: Run callback tests and verify the new tests fail**

Run: `pnpm test app/auth/callback/route.test.ts`

Expected: FAIL because `next` is currently ignored.

- [ ] **Step 3: Implement safe destination handling**

Read `next`, accept only a path beginning with `/`, default to `/password-setup`, and use that destination after a successful code exchange.

- [ ] **Step 4: Run callback tests**

Run: `pnpm test app/auth/callback/route.test.ts`

Expected: PASS.

### Task 3: Add Recovery UI to Login

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/login/recovery-actions.ts` only if UI state types need sharing

**Interfaces:**
- Login remains the primary sign-in form.
- A secondary action labeled `Crear o restablecer contraseña` reveals an email form using `requestPasswordRecovery`.

- [ ] **Step 1: Add a component test for the recovery trigger and form**

Assert the secondary action is present and the recovery form renders the email input and submit label after activation.

- [ ] **Step 2: Run the focused component test and verify it fails**

Run: `pnpm test app/login/page.test.tsx`

Expected: FAIL because the recovery trigger and form are not present.

- [ ] **Step 3: Implement the accessible recovery UI**

Use the existing `useActionState`, `Button`, `Input`, `BinaryLoader`, focus-visible styles, and status/alert semantics. Keep the form responsive and allow returning to the normal login view.

- [ ] **Step 4: Run the focused component test**

Run: `pnpm test app/login/page.test.tsx`

Expected: PASS.

### Task 4: Add Admin Send-Setup-Link Action

**Files:**
- Modify: `app/(protected)/settings/users/actions.ts`
- Modify: `app/(protected)/settings/users/actions.test.ts`

**Interfaces:**
- Produces `sendPasswordSetupLinkAction(_state, formData): Promise<UserManagementFormState>`.
- Accepts a UUID `targetUserId`; only active admins may invoke it.

- [ ] **Step 1: Add failing server-action tests**

Test that a disabled admin is rejected, malformed target IDs do not call the service, and a valid target calls the password-recovery service with the organization ID, target ID, and callback URL.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm test "app/(protected)/settings/users/actions.test.ts"`

Expected: FAIL because the action and service mock do not exist.

- [ ] **Step 3: Implement the action and provider call**

Authorize through `requireActiveAdmin`, rate-limit, validate the target UUID, resolve the target within the actor organization, call `resetPasswordForEmail` with `/auth/callback?next=/password-setup`, and return a generic success/error state. Do not audit the recipient email or provider response.

- [ ] **Step 4: Run the focused tests**

Run: `pnpm test "app/(protected)/settings/users/actions.test.ts"`

Expected: PASS.

### Task 5: Add the Admin User-Row Control

**Files:**
- Modify: `app/(protected)/settings/users/user-management.tsx`
- Modify: `app/(protected)/settings/users/actions.test.ts` if UI behavior is covered there

**Interfaces:**
- Each managed user row renders `Enviar enlace de acceso`.
- The control has pending, success, and error states and submits only the target UUID.

- [ ] **Step 1: Add the failing UI assertion**

Assert each managed user row includes the new action and that the button is disabled while its action is pending.

- [ ] **Step 2: Run the focused UI test and verify it fails**

Run: `pnpm test "app/(protected)/settings/users/user-management.test.tsx"`

Expected: FAIL because the control is not present.

- [ ] **Step 3: Implement the row action**

Wire a dedicated `useActionState` to `sendPasswordSetupLinkAction`, render the button beside role/status actions, and show a non-color-only status message below the user list.

- [ ] **Step 4: Run the focused UI test**

Run: `pnpm test "app/(protected)/settings/users/user-management.test.tsx"`

Expected: PASS.

### Task 6: Verify the Complete Flow

**Files:**
- Modify: tests only if a verified regression is found.

- [ ] **Step 1: Run all focused auth and user-management tests**

Run: `pnpm test app/auth/callback/route.test.ts app/password-setup/actions.test.ts app/login/recovery-actions.test.ts "app/(protected)/settings/users/actions.test.ts"`

Expected: PASS.

- [ ] **Step 2: Run lint and typecheck**

Run: `pnpm lint`

Run: `pnpm typecheck`

Expected: no new lint or type errors attributable to this change.

- [ ] **Step 3: Run the production build**

Run: `pnpm build`

Expected: successful Next.js production build.

- [ ] **Step 4: Manually verify with a fresh recovery request**

From login, request a password link for the invited email, open the newest email, set a 12-character password, and confirm redirect into the protected app. Repeat from Settings > Users and verify the same result.
