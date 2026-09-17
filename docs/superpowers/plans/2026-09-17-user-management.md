# Organization-Scoped User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an active-ADMIN-only Settings > Users module that safely manages users only within the caller's organization.

**Architecture:** Keep privileged Auth administration in the server-only Supabase admin boundary and place all authorization, tenant scoping, rate limiting, validation, auditing, and cache invalidation in server actions. Extend the existing `users` and `audit` modules for persistence and business rules; render the management list in a protected server route and use focused client forms for mutations. The invitation callback establishes a cookie-backed session, then the password-setup action changes credentials only through the authenticated server client.

**Tech Stack:** Next.js 16.3.4 App Router and Server Actions, React 19.2.8, TypeScript 5, Zod 4.5.4, Supabase JS/Auth 2.116.0, Drizzle ORM/Postgres, Vitest 5, pnpm 11, Node 22.

## Global Constraints

- Both the page and every mutation require the current user to be active and have `ADMIN` role.
- The current ADMIN's `profile.organizationId` is the only organization scope used for reads and writes; client-provided organization IDs are ignored.
- Supabase Auth owns email, invitation, and password; `public.users.id` is the matching Auth user ID.
- The UI presents `ADMIN` and `User`; `User` persists as `MARKETING_USER`.
- Profiles remain `active` or `disabled`; users are never deleted.
- Provision Auth first, then profile; delete only a newly created Auth identity when its profile creation fails.
- Do not expose temporary passwords, provider tokens, invitation URLs, service-role credentials, raw provider responses, account deletion, email changes, organization transfer, bulk management, or roles other than `ADMIN` and `User`.
- Every successful mutation records an append-only, organization-scoped audit event and revalidates `/settings/users` and `/settings`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; do not prefix it with `NEXT_PUBLIC_` or import `src/lib/supabase/admin.ts` from a Client Component.
- V1 does not provide invitation resend. The pinned Supabase SDK has no verified safe
  existing-identity resend operation; retain
  `docs/superpowers/evidence/2026-09-17-supabase-invitation-resend.md` as the rationale and do
  not call `inviteUserByEmail` as a resend fallback because it creates an identity.

---

## Existing File Map

| Path | Current responsibility | Planned change |
| --- | --- | --- |
| `app/(protected)/layout.tsx` | Redirects unauthenticated or disabled users to `/login`. | Leave unchanged; the Users page adds its own ADMIN gate. |
| `app/(protected)/settings/page.tsx` | Existing Settings server page. | Add an ADMIN-only Users entry point. |
| `app/(protected)/settings/actions.ts` | Existing Settings server-action convention. | Leave unchanged; isolate user-management mutations under `settings/users`. |
| `src/modules/users/service.ts` and `index.ts` | Profiles, organization helpers, `isAdmin`, and `isActive`. | Add management repository/service exports without exposing database internals. |
| `src/modules/audit/db.ts`, `service.ts`, and `index.ts` | Audit enum, append-only writer, shared rate limiter. | Add the four user-management audit actions and retain the existing writer/rate limiter. |
| `src/lib/supabase/admin.ts` | Sole service-role client boundary. | Reuse only from server-side invitation provisioning. |
| `src/lib/supabase/server.ts` | Cookie-backed authenticated Supabase server client. | Reuse for callback and password update. |
| `proxy.ts` | Next 16 session-refresh proxy. | Leave unchanged; it is not an invitation callback. |
| `drizzle.config.ts`, `src/db/schema.ts`, `drizzle/meta/_journal.json` | Drizzle schema and migration machinery. | Generate and review one migration for audit enum values; do not alter deployment configuration in this work. |
| `app/(protected)/qr/bulk-actions.test.ts` | Vitest server-action mocking pattern. | Use as the action-test pattern for user-management actions. |
| `src/modules/audit/rate-limit.test.ts` | Vitest unit-test convention. | Keep as the rate-limit reference; do not duplicate limiter logic. |

## Task 1: Add Audit Values and Concurrency-Safe Organization Mutations

**Files:**
- Modify: `src/modules/audit/db.ts:5-11`
- Modify: `src/modules/users/service.ts:1-79`
- Modify: `src/modules/users/index.ts:1-18`
- Create: `src/modules/users/management.ts`
- Create: `src/modules/users/management.test.ts`
- Create: `drizzle/0015_user_management_audit_actions.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0015_snapshot.json`

**Interfaces:**
- Consumes: `Profile`, `UserRole`, and `UserStatus` from `src/modules/users/service.ts`; `authUsers` from `src/db/auth-schema-ref.ts`.
- Produces:

```ts
export type ManagedUser = Pick<Profile, "id" | "organizationId" | "role" | "status" | "createdAt"> & {
  email: string;
};
export type ManagedRole = "ADMIN" | "MARKETING_USER";
export type ManagementMutationResult =
  | { ok: true; user: ManagedUser; before: { role: ManagedRole; status: UserStatus } }
  | { ok: false; reason: "target_not_found" | "self_disable" | "last_active_admin" };
export function listManagedUsers(organizationId: string): Promise<ManagedUser[]>;
export function changeManagedUserRole(input: { organizationId: string; actorId: string; targetUserId: string; role: ManagedRole }): Promise<ManagementMutationResult>;
export function setManagedUserStatus(input: { organizationId: string; actorId: string; targetUserId: string; status: "active" | "disabled" }): Promise<ManagementMutationResult>;
```

- [ ] **Step 1: Write failing repository tests for scope and lifecycle invariants**

```ts
it("returns target_not_found when the target is outside the actor organization", async () => {
  await expect(
    setManagedUserStatus({ organizationId: "org-1", actorId: "actor-1", targetUserId: "org-2-user", status: "disabled" }),
  ).resolves.toEqual({ ok: false, reason: "target_not_found" });
});

it("rejects demoting the final active ADMIN while holding the organization user rows", async () => {
  await expect(
    changeManagedUserRole({ organizationId: "org-1", actorId: "actor-2", targetUserId: "admin-1", role: "MARKETING_USER" }),
  ).resolves.toEqual({ ok: false, reason: "last_active_admin" });
});
```

- [ ] **Step 2: Run the repository tests to verify RED**

Run: `pnpm test src/modules/users/management.test.ts`

Expected: FAIL because the management repository functions do not exist.

- [ ] **Step 3: Generate the audit-enum migration from the schema change**

Add these values to the `auditAction` enum in `src/modules/audit/db.ts`:

```ts
"invite_user",
"change_user_role",
"disable_user",
"reactivate_user",
```

Run: `pnpm db:generate`

Expected: Drizzle creates `drizzle/0015_user_management_audit_actions.sql` and `drizzle/meta/0015_snapshot.json`; the SQL uses `ALTER TYPE "public"."audit_action" ADD VALUE` for exactly the four values.

- [ ] **Step 4: Implement the scoped list and locked lifecycle transaction**

```ts
export async function listManagedUsers(organizationId: string): Promise<ManagedUser[]> {
  return db
    .select({ id: users.id, organizationId: users.organizationId, role: users.role, status: users.status, createdAt: users.createdAt, email: authUsers.email })
    .from(users)
    .innerJoin(authUsers, eq(users.id, authUsers.id))
    .where(eq(users.organizationId, organizationId))
    .orderBy(asc(authUsers.email));
}

// Lock every profile in the organization before counting/writing, so concurrent
// ADMIN demotions/disables serialize and cannot remove the final active ADMIN.
await tx.execute(sql`select id from public.users where organization_id = ${organizationId} for update`);
```

Within the same `db.transaction`, load the target with both `id` and `organization_id`, return `target_not_found` when absent, reject `actorId === targetUserId` only for disable, and count `role = 'ADMIN' AND status = 'active'` before disabling or demoting an active ADMIN. Return the updated `ManagedUser` plus its prior role/status only after the update succeeds.

- [ ] **Step 5: Export the public management surface**

```ts
export {
  listManagedUsers,
  changeManagedUserRole,
  setManagedUserStatus,
  type ManagedUser,
  type ManagedRole,
  type ManagementMutationResult,
} from "./management";
```

- [ ] **Step 6: Run focused tests and type checking to verify GREEN**

Run: `pnpm test src/modules/users/management.test.ts`

Expected: PASS; tests prove cross-organization targets, self-disable, and final-active-ADMIN role/status changes fail before a write.

Run: `pnpm typecheck`

Expected: PASS with `auditAction` inferred as including all four new values.

- [ ] **Step 7: Commit the persistence unit**

```bash
git add src/modules/audit/db.ts src/modules/users/service.ts src/modules/users/index.ts src/modules/users/management.ts src/modules/users/management.test.ts drizzle/0015_user_management_audit_actions.sql drizzle/meta/_journal.json drizzle/meta/0015_snapshot.json
```

### Task 2: Implement Auth Provisioning with Compensation

**Files:**
- Modify: `src/modules/users/management.ts`
- Modify: `src/modules/users/index.ts`
- Modify: `src/lib/supabase/admin.ts`
- Modify: `src/modules/users/management.test.ts`

**Interfaces:**
- Consumes: the server-only Supabase admin boundary and `createProfile(input)` from `src/modules/users/service.ts`.
- Produces:

```ts
export type InviteManagedUserInput = {
  organizationId: string;
  email: string;
  role: ManagedRole;
  emailRedirectTo: string;
};
export type InviteManagedUserResult =
  | { ok: true; user: ManagedUser }
  | { ok: false; reason: "duplicate" | "provider_failure" | "profile_failure" };
export function inviteManagedUser(input: InviteManagedUserInput): Promise<InviteManagedUserResult>;
```

- [ ] **Step 1: Write failing provisioning tests**

```ts
it("creates the profile only after Auth provisioning returns an ID", async () => {
  await inviteManagedUser({ organizationId: "org-1", email: "new@example.com", role: "MARKETING_USER", emailRedirectTo: "https://app.example.com/auth/callback" });
  expect(callLog).toEqual(["invite-auth", "create-profile"]);
});

it("deletes the newly created Auth identity when profile creation fails", async () => {
  mocks.createProfile.mockRejectedValue(new Error("database unavailable"));
  await expect(inviteManagedUser(validInput)).resolves.toEqual({ ok: false, reason: "profile_failure" });
  expect(mocks.deleteUser).toHaveBeenCalledWith("new-auth-user-id");
});
```

- [ ] **Step 2: Run the provisioning tests to verify RED**

Run: `pnpm test src/modules/users/management.test.ts`

Expected: FAIL because `inviteManagedUser` is absent or does not compensate.

- [ ] **Step 3: Implement the minimal provisioning sequence**

```ts
export async function inviteManagedUser(input: InviteManagedUserInput): Promise<InviteManagedUserResult> {
  const existing = await findManagedUserByEmail(input.organizationId, input.email);
  if (existing) return { ok: false, reason: "duplicate" };

  const invited = await invitationGateway.inviteNewUser({ email: input.email, emailRedirectTo: input.emailRedirectTo });
  if (!invited.ok) return { ok: false, reason: invited.error };

  try {
    const profile = await createProfile({ id: invited.authUserId, organizationId: input.organizationId, role: input.role });
    return { ok: true, user: await toManagedUser(profile.id) };
  } catch (error) {
    await invitationGateway.deleteUser(invited.authUserId).catch(() => logCompensationFailure(error, invited.authUserId));
    return { ok: false, reason: "profile_failure" };
  }
}
```

`logCompensationFailure` must log only operation context and the Auth UUID, never an email invite URL, token, service-role key, or raw provider response. It is operational logging, not a successful audit event.

- [ ] **Step 4: Bind the verified new-invitation transport at the admin boundary**

```ts
const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
  redirectTo: emailRedirectTo,
});
```

Map an Auth error to `duplicate` only when the provider identifies an existing identity; otherwise map it to `provider_failure`. Do not create `public.users` on either failure path.

- [ ] **Step 5: Run the provisioning tests to verify GREEN**

Run: `pnpm test src/modules/users/management.test.ts`

Expected: PASS; an Auth failure creates no profile, a profile failure invokes one cleanup attempt, and no successful invite audit is emitted by this service.

- [ ] **Step 6: Commit the provisioning unit**

```bash
git add src/modules/users/management.ts src/modules/users/index.ts src/lib/supabase/admin.ts src/modules/users/management.test.ts
```

### Task 3: Build the Authorized User-Management Server Actions

**Files:**
- Create: `app/(protected)/settings/users/actions.ts`
- Create: `app/(protected)/settings/users/actions.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `isActive`, `isAdmin`, `checkRateLimit`, `recordAudit`, and Task 2/3 service functions.
- Produces:

```ts
export type UserManagementFormState = { error?: string; success?: string };
export async function inviteUserAction(_state: UserManagementFormState, formData: FormData): Promise<UserManagementFormState>;
export async function changeUserRoleAction(_state: UserManagementFormState, formData: FormData): Promise<UserManagementFormState>;
export async function disableUserAction(_state: UserManagementFormState, formData: FormData): Promise<UserManagementFormState>;
export async function reactivateUserAction(_state: UserManagementFormState, formData: FormData): Promise<UserManagementFormState>;
```

- [ ] **Step 1: Write failing action-boundary tests**

```ts
it("does not call services, audit, or revalidation for a disabled ADMIN", async () => {
  mocks.getCurrentUser.mockResolvedValue({ ...admin, profile: { ...admin.profile, status: "disabled" } });
  await expect(inviteUserAction({}, inviteFormData())).resolves.toEqual({ error: "No tienes permiso para administrar usuarios." });
  expect(mocks.inviteManagedUser).not.toHaveBeenCalled();
  expect(mocks.recordAudit).not.toHaveBeenCalled();
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});

it("maps User to MARKETING_USER and audits only a successful invite", async () => {
  await inviteUserAction({}, inviteFormData({ role: "User" }));
  expect(mocks.inviteManagedUser).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", role: "MARKETING_USER" }));
  expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "invite_user", resourceType: "user", resourceId: "target-1" }));
});
```

- [ ] **Step 2: Run the action tests to verify RED**

Run: `pnpm test app/(protected)/settings/users/actions.test.ts`

Expected: FAIL because the action module and exported action functions do not exist.

- [ ] **Step 3: Define strict form schemas and the shared authorization sequence**

```ts
const inviteSchema = z.object({ email: z.string().trim().email().max(254), role: z.enum(["ADMIN", "User"]) });
const targetSchema = z.object({ targetUserId: z.string().uuid() });
const roleChangeSchema = targetSchema.extend({ role: z.enum(["ADMIN", "User"]) });

async function requireActiveAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}
```

Every action must execute this order: authenticate and authorize; apply `checkRateLimit(user.id)`; parse with `safeParse`; invoke a service using `user.profile.organizationId`; record success-only audit data; then call `revalidatePath("/settings/users")` and `revalidatePath("/settings")`.

- [ ] **Step 4: Implement invite, role, and status actions with safe outcomes**

```ts
const role: ManagedRole = parsed.data.role === "User" ? "MARKETING_USER" : "ADMIN";
const result = await changeManagedUserRole({
  organizationId: user.profile.organizationId,
  actorId: user.id,
  targetUserId: parsed.data.targetUserId,
  role,
});
```

For absent/out-of-organization targets return the same `"El usuario no está disponible."` state. For `self_disable` and `last_active_admin`, return actionable Spanish UI messages before audit/revalidation.

- [ ] **Step 5: Add complete success and failure assertions**

```ts
it("revalidates both Settings paths only after a successful role update", async () => {
  await changeUserRoleAction({}, roleFormData("target-1", "ADMIN"));
  expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/settings/users");
  expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/settings");
});
```

- [ ] **Step 6: Run focused action tests to verify GREEN**

Run: `pnpm test app/(protected)/settings/users/actions.test.ts`

Expected: PASS; non-ADMIN/disabled/rate-limited callers produce no privileged call, malformed form values produce no mutation, and every successful operation has the correct audit payload and path revalidation.

- [ ] **Step 7: Commit the server-action unit**

```bash
git add app/(protected)/settings/users/actions.ts app/(protected)/settings/users/actions.test.ts
```

### Task 4: Add the Protected Users Route and Interaction Components

**Files:**
- Create: `app/(protected)/settings/users/page.tsx`
- Create: `app/(protected)/settings/users/user-management.tsx`
- Modify: `app/(protected)/settings/page.tsx:1-75`
- Modify: `app/(protected)/sidebar.tsx:149-167`
- Modify: `app/(protected)/breadcrumb.tsx:10-28`
- Create: `app/(protected)/settings/users/page.test.tsx`

**Interfaces:**
- Consumes: `listManagedUsers(organizationId)`, `getCurrentUser()`, `isActive()`, `isAdmin()`, and all Task 4 actions.
- Produces:

```ts
export default async function UsersSettingsPage(): Promise<JSX.Element>;
export function UserManagement({ users }: { users: ManagedUser[] }): JSX.Element;
```

- [ ] **Step 1: Write the failing page tests for the server gate and tenant list**

```tsx
it("returns notFound for an active non-ADMIN", async () => {
  mocks.getCurrentUser.mockResolvedValue(marketingUser);
  await expect(UsersSettingsPage()).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mocks.listManagedUsers).not.toHaveBeenCalled();
});

it("lists only the current ADMIN organization users", async () => {
  await UsersSettingsPage();
  expect(mocks.listManagedUsers).toHaveBeenCalledWith("org-1");
});
```

- [ ] **Step 2: Run the page test to verify RED**

Run: `pnpm test app/(protected)/settings/users/page.test.tsx`

Expected: FAIL because `UsersSettingsPage` and its module do not exist.

- [ ] **Step 3: Implement the server route gate and data handoff**

```tsx
export default async function UsersSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const users = await listManagedUsers(user.profile.organizationId);
  return <UserManagement users={users} />;
}
```

- [ ] **Step 4: Implement the minimal accessible client forms**

```tsx
const [inviteState, inviteAction, invitePending] = useActionState(inviteUserAction, {});

<form action={inviteAction}>
  <input name="email" type="email" autoComplete="email" required />
  <select name="role" defaultValue="User"><option>ADMIN</option><option>User</option></select>
  <button disabled={invitePending} type="submit">Invitar usuario</button>
</form>
```

Render email, `ADMIN`/`User`, and `active`/`disabled` status for each supplied `ManagedUser`. Use target ID hidden fields for role, disable, and reactivate actions. Do not render unsupported roles, a delete control, or invitation resend controls.

- [ ] **Step 5: Link Users from Settings navigation without weakening authorization**

Add the link only when the existing Settings page's current user is active and ADMIN, and add a matching ADMIN-only sidebar item. Add `/settings/users` breadcrumb handling before the generic `/settings` case so it displays `Configuración / Usuarios`.

- [ ] **Step 6: Run component/page tests to verify GREEN**

Run: `pnpm test app/(protected)/settings/users/page.test.tsx`

Expected: PASS; non-ADMINs cannot load user data and the query receives only `org-1`.

- [ ] **Step 7: Commit the UI unit**

```bash
git add app/(protected)/settings/users/page.tsx app/(protected)/settings/users/user-management.tsx app/(protected)/settings/users/page.test.tsx app/(protected)/settings/page.tsx app/(protected)/sidebar.tsx app/(protected)/breadcrumb.tsx
```

### Task 5: Add Invitation Callback and Password Setup

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `app/auth/callback/route.test.ts`
- Create: `app/password-setup/page.tsx`
- Create: `app/password-setup/actions.ts`
- Create: `app/password-setup/actions.test.ts`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/server.ts`.
- Produces:

```ts
export async function GET(request: Request): Promise<Response>;
export type PasswordSetupFormState = { error?: string };
export async function setInvitationPassword(_state: PasswordSetupFormState, formData: FormData): Promise<PasswordSetupFormState>;
```

- [ ] **Step 1: Write failing callback and password-action tests**

```ts
it("exchanges a valid invitation code and redirects to password setup", async () => {
  await GET(new Request("https://app.example.com/auth/callback?code=code-1"));
  expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("code-1");
  expect(mocks.redirect).toHaveBeenCalledWith("https://app.example.com/password-setup");
});

it("does not update a password without an authenticated invitation session", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  await expect(setInvitationPassword({}, passwordFormData("correct horse battery staple"))).resolves.toEqual({ error: "La invitación no es válida o expiró." });
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the auth-route tests to verify RED**

Run: `pnpm test app/auth/callback/route.test.ts app/password-setup/actions.test.ts`

Expected: FAIL because the callback and password setup action do not exist.

- [ ] **Step 3: Implement the callback as a Next App Router route handler**

```ts
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=invitation", request.url));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=invitation", request.url));
  return NextResponse.redirect(new URL("/password-setup", request.url));
}
```

The handler must not return provider errors, tokens, or codes to the browser.

- [ ] **Step 4: Implement server-side password validation and authenticated update**

```ts
const passwordSchema = z.object({ password: z.string().min(12).max(200) });

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { error: "La invitación no es válida o expiró." };
const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
if (error) return { error: "No se pudo actualizar la contraseña. Inténtalo de nuevo." };
redirect("/");
```

The page uses `useActionState(setInvitationPassword, {})`, `autoComplete="new-password"`, confirmation matching in the Zod schema, and a retry-safe alert. It does not accept a user ID, organization ID, or temporary password.

- [ ] **Step 5: Run focused auth tests to verify GREEN**

Run: `pnpm test app/auth/callback/route.test.ts app/password-setup/actions.test.ts`

Expected: PASS; invalid/missing codes never enter protected content, and only an authenticated session can invoke `auth.updateUser`.

- [ ] **Step 6: Commit the invitation completion unit**

```bash
git add app/auth/callback/route.ts app/auth/callback/route.test.ts app/password-setup/page.tsx app/password-setup/actions.ts app/password-setup/actions.test.ts
```

### Task 6: Verify the Complete Feature and Production Preconditions

**Files:**
- Modify: `docs/superpowers/plans/2026-09-17-user-management.md`

**Interfaces:**
- Consumes: all prior tasks and the production deployment environment.
- Produces: verified test/build evidence and a release checklist; no production configuration is modified by this task.

- [ ] **Step 1: Run all user-management-focused tests**

Run: `pnpm test src/modules/users/management.test.ts app/(protected)/settings/users/actions.test.ts app/(protected)/settings/users/page.test.tsx app/auth/callback/route.test.ts app/password-setup/actions.test.ts`

Expected: PASS; the suite covers authorization, tenant scope, validation, mapping, compensation, final-ADMIN serialization contract, audit/revalidation, and invitation password setup.

- [ ] **Step 2: Run repository quality gates**

Run: `pnpm lint`

Expected: PASS with no client import of `src/lib/supabase/admin.ts`.

Run: `pnpm typecheck`

Expected: PASS with no audit-action or Server Action signature errors.

Run: `pnpm test`

Expected: PASS.

Run: `pnpm build`

Expected: PASS; Next 16 recognizes `app/auth/callback/route.ts` as a route handler and produces the protected Users and password-setup routes.

- [ ] **Step 3: Perform a manual staging acceptance pass**

Execute with two organizations and at least two active ADMIN profiles in one organization: invite `ADMIN` and `User`; reject malformed input, disabled and non-ADMIN callers, cross-organization targets, self-disable, last-ADMIN disable/demotion; then disable/reactivate and confirm only success paths emit audit records and refresh the Users list. Confirm invitation callback redirects to password setup, password update establishes protected access, and no credential/token appears in rendered HTML, logs, or audit data.

Expected: every mutation is scoped to the actor organization; no action can delete an existing managed account; invitation resend is not offered in V1.

- [ ] **Step 4: Verify deployment prerequisites without changing them in this implementation task**

Confirm, through the deployment operator, that the production Supabase Auth redirect allow list contains the exact production `https://<production-host>/auth/callback` URL and that local/staging contain their equivalent callback URLs. Confirm `SUPABASE_SERVICE_ROLE_KEY` exists only in the server runtime secret store and is absent from all `NEXT_PUBLIC_*` variables, browser bundles, and client component imports.

Expected: configuration is confirmed by the operator before release; this code task does not edit production configuration.

- [ ] **Step 5: Commit the verified plan only after all gates are green**

```bash
git add docs/superpowers/plans/2026-09-17-user-management.md
```

## Self-Review

### Spec Coverage

- [x] ADMIN route and mutation authorization, organization-scoped reads/writes, disabled caller rejection, and safe target-not-found behavior: Tasks 1, 3, and 4.
- [x] V1 role display/persistence mapping, active/disabled lifecycle, no deletion, no unsupported roles: Tasks 1, 3, and 4.
- [x] Auth-first invitation, profile creation, compensation cleanup, no successful partial invite: Task 2.
- [x] Invitation resend is excluded from V1 because the pinned SDK lacks a verified safe existing-identity operation; the evidence document records the rationale.
- [x] Last-active-ADMIN serialization-safe check and self-disable block: Task 1 with locked transaction and Task 3 tests.
- [x] Zod validation, rate limiting, audit records without sensitive data, and revalidation after success only: Task 3.
- [x] Callback/session exchange and authenticated password setup without temporary passwords: Task 5.
- [x] Focused Vitest coverage, full quality gates, Supabase redirect allow-list, and server-only service key verification: Task 6.

### Placeholder Scan

- [x] The plan contains no implementation placeholders, deferred error handling, invented API names, or generic "write tests" steps.
- [x] Invitation resend is intentionally excluded from V1 because SDK 2.116.0 and current documentation do not establish a safe existing-identity resend API; the retained evidence document records this decision.

### Type Consistency

- [x] UI role input is `"ADMIN" | "User"`; server actions map it to `ManagedRole` (`"ADMIN" | "MARKETING_USER"`) before service calls.
- [x] `ManagedUser.id` is the Supabase Auth UUID used consistently as target ID, profile ID, and audit `resourceId`.
- [x] `UserManagementFormState`, route handler `GET`, and password action signatures are defined before their components/tests consume them.
- [x] No action consumes a client-provided organization ID.
