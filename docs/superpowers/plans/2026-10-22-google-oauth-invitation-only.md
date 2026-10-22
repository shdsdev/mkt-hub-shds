# Google OAuth Invitation-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Google sign-in only for users already invited by an administrator and carrying an active `public.users` profile.

**Architecture:** Reuse the existing Supabase SSR PKCE callback and cookie session. The browser starts Google OAuth with `signInWithOAuth`; the existing callback exchanges the code, then verifies the resulting Supabase user has an active Marketing Hub profile. Public signup and automatic profile creation remain disabled.

**Tech Stack:** Next.js App Router, React, `@supabase/ssr`, Supabase Auth, TypeScript, Vitest.

## Global Constraints

- Access is invitation-only; do not create profiles automatically.
- Do not change password login, invitations, recovery, or logout behavior.
- Do not restrict by email domain; authorization comes from the admin-created Supabase user and active `public.users` profile.
- Use PKCE and the existing `/auth/callback` route.
- Do not expose provider errors or reveal whether an email exists.
- Store Google OAuth credentials in Supabase/Google Cloud configuration, never in the repository.
- Keep `.atl/` and `.codex/` out of commits.

---

### Task 1: Add invitation-only OAuth callback enforcement

**Files:**
- Modify: `app/auth/callback/route.ts`
- Test: `app/auth/callback/route.test.ts` (create if absent)

**Interfaces:**
- Consume the existing `createClient()` and `getCurrentUser()`.
- Preserve the existing safe `next` handling and invitation/recovery destinations.

- [ ] **Step 1: Write failing callback tests**

Cover these behaviors:

```ts
it("redirects an OAuth user with an active profile to the requested next path", async () => {
  // exchangeCodeForSession succeeds; getCurrentUser returns an active profile
  // expect redirect to /
});

it("signs out and rejects a Google user without a Marketing Hub profile", async () => {
  // exchangeCodeForSession succeeds; getCurrentUser returns undefined
  // expect signOut and redirect to /login?error=google_access
});

it("signs out and rejects an inactive profile", async () => {
  // exchangeCodeForSession succeeds; getCurrentUser returns inactive profile
  // expect signOut and redirect to /login?error=google_access
});
```

- [ ] **Step 2: Run the callback tests and confirm the expected failure**

```bash
pnpm vitest run app/auth/callback/route.test.ts
```

Expected: FAIL because the callback currently redirects after exchange without checking the Marketing Hub profile.

- [ ] **Step 3: Add the profile gate**

After successful code/OTP exchange, only apply the gate for the Google login destination (`next=/`). Keep invitation/recovery flows intact. Use `getCurrentUser()` and `isActive`; on failure call `supabase.auth.signOut()` and redirect to `/login?error=google_access`.

- [ ] **Step 4: Run the callback tests**

```bash
pnpm vitest run app/auth/callback/route.test.ts
```

Expected: PASS.

### Task 2: Enable the Google button in the login page

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/login/actions.ts` only if the shared error type needs a named Google error.
- Test: `app/login/page.test.tsx` or the existing login test location.

**Interfaces:**
- Use the browser `createClient()` from `src/lib/supabase/client.ts`.
- Start OAuth with `provider: "google"` and `redirectTo: ${window.location.origin}/auth/callback?provider=google&next=/`.

- [ ] **Step 1: Add a failing UI behavior test**

Assert that the Google button is enabled, has the accessible label `Continuar con Google`, and starts the OAuth call with the Google provider and same-origin callback.

- [ ] **Step 2: Run the UI test and verify failure**

```bash
pnpm vitest run app/login/page.test.tsx
```

Expected: FAIL because the button is currently disabled and has no OAuth handler.

- [ ] **Step 3: Implement the browser OAuth handler**

Use a client click handler:

```tsx
async function handleGoogleSignIn() {
  setGooglePending(true);
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?provider=google&next=/` },
  });
  if (error) {
    setGooglePending(false);
    setGoogleError("No se pudo iniciar sesión con Google.");
  }
}
```

Keep the existing button classes, Google icon, tooltip wrapper removal, pending state, and accessible error feedback. Do not use the server action intended for password login.

- [ ] **Step 4: Run the UI test**

```bash
pnpm vitest run app/login/page.test.tsx
```

Expected: PASS.

### Task 3: Surface generic OAuth access errors

**Files:**
- Modify: `app/login/page.tsx`
- Test: `app/login/page.test.tsx`

- [ ] **Step 1: Add a failing error-state assertion**

When the callback redirects with `?error=google_access`, assert that the page displays `Tu cuenta no tiene una invitación activa para Marketing Hub.` without displaying the email or provider error.

- [ ] **Step 2: Implement the query-param mapping**

Add a boolean derived from `authError === "google_access"` and render one generic alert beside the existing invitation/recovery alerts.

- [ ] **Step 3: Run the test**

```bash
pnpm vitest run app/login/page.test.tsx
```

Expected: PASS.

### Task 4: Verify external configuration and complete the work unit

**Files:**
- Documentation only if the project has an auth setup guide: `docs/ARCHITECTURE.md` or the existing auth documentation.

- [ ] **Step 1: Configure Google Cloud without committing secrets**

Create a Web OAuth client and set:

- Authorized JavaScript origins: local app origin and production app origin.
- Authorized redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`.

- [ ] **Step 2: Configure Supabase Auth**

Set the Google Client ID and Client Secret in the Google provider, add application redirect URLs for local and production `/auth/callback`, and disable public signup. Existing invited users must retain access.

- [ ] **Step 3: Run project verification**

```bash
pnpm vitest run app/auth/callback/route.test.ts app/login/page.test.tsx
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Expected: all commands pass.

- [ ] **Step 4: Manual acceptance flow**

Verify one invited active user can sign in with Google, one non-invited Google account is rejected, and one inactive profile is rejected. Confirm password login and password recovery still work.

- [ ] **Step 5: Commit only the auth work unit**

```bash
git add app/auth/callback/route.ts app/auth/callback/route.test.ts app/login/page.tsx app/login/page.test.tsx
git commit -m "feat(auth): enable invitation-only Google sign-in"
```

Do not stage credentials, `.atl/`, `.codex/`, or unrelated changes.
