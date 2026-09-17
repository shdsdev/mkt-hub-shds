# Design: Organization-Scoped User Management

This design adds an ADMIN-only **Settings > Users** module. An administrator can invite,
disable, reactivate, and assign the V1 role of users in their own organization. Supabase owns
credentials and invitation email; `public.users` remains the application profile and
organization-membership record.

## Quick Path

1. An active ADMIN opens **Settings > Users** and sees only profiles in their organization.
2. The ADMIN invites a user by email and selects either `ADMIN` or `User` (`MARKETING_USER`).
3. The server creates the Auth identity, creates its organization-scoped profile, and sends the
   Supabase invitation. The recipient follows the link through the auth callback, sets their own
   password, and enters the application.

The module never exposes temporary passwords, deletes accounts, other organizations' users, or
unimplemented granular roles.

## Scope

**In**

- An ADMIN-only Settings > Users page for listing organization users and performing V1 user
  management actions.
- Invite, role assignment, disable, and reactivate operations.
- An auth callback and password-setup route for the Supabase invitation flow.
- Server-only service-role provisioning, audit events, rate limiting, Zod validation,
  revalidation, and focused Vitest server-action tests.
- Schema support needed for user-management audit actions. The existing `users.status` values
  (`active`, `disabled`) remain the status model.

**Out**

- User deletion, organization transfer, changing email addresses, or restoring deleted accounts.
- Temporary passwords, administrator-set passwords, public sign-up, or credential storage in
  `public.users`.
- Roles other than `ADMIN` and `User` (`MARKETING_USER`). Existing enum values such as
  `MARKETING_MANAGER` and `VIEWER` are not selectable or displayed as new choices.
- Granular permissions, invitation-expiry policy, invitation analytics, and bulk user management.
- Invitation resend. The pinned Supabase SDK has no verified safe operation for resending an
  invitation to an existing Auth identity; see
  `docs/superpowers/evidence/2026-09-17-supabase-invitation-resend.md`.

## Design Summary

| Topic | Decision |
| --- | --- |
| Access | Both the page and every mutation require the current user to be active and have `ADMIN` role. |
| Tenant boundary | The current ADMIN's `profile.organizationId` is the only organization scope used for reads and writes. Client-provided organization IDs are ignored. |
| Identity | Supabase Auth owns email, invitation, and password. `public.users.id` is the matching Auth user ID. |
| Roles | The UI presents `ADMIN` and `User`; `User` persists as `MARKETING_USER`. |
| Lifecycle | Profiles remain `active` or `disabled`; users are never deleted. Pending invitation acceptance is Auth state, not a new profile status. |
| Consistency | Provision Auth first, then profile. If profile creation fails, delete the newly created Auth identity as compensation. |
| Refresh | Successful mutations revalidate the Users page and relevant Settings layout/path so server-rendered data is current. |

## Architecture

The feature follows the existing module boundaries instead of putting authorization or Supabase
admin access in client components.

| Layer | Responsibility |
| --- | --- |
| `app/(protected)/settings/users` | Server-rendered route and client interaction components. The route enforces the UI gate and supplies only organization-scoped data. |
| Settings user-management server actions | Authenticate caller, apply rate limit, validate input with Zod, load the authoritative caller profile, enforce invariants, invoke the service layer, record an audit event, and revalidate. |
| User-management service/repository functions | Query profiles and Auth email data by organization; perform profile role/status mutations; count active ADMINs; coordinate provisioning and compensation. |
| `src/lib/supabase/admin.ts` | Existing server-only service-role client. It is the sole boundary for privileged Supabase Auth administration and must not be imported by client code. |
| Auth callback and password setup route | Exchange the invitation code for a server-side session, route the recipient to password setup, validate the password server-side, and update it through the authenticated Supabase server client. |
| Audit module | Append-only user-management audit records, scoped to the actor's organization. |

The existing `proxy.ts` remains the Next 16 proxy that refreshes the Supabase session. It does not
replace the new auth callback or password-setup route; neither route exists today.

## Data and Routing

The existing `public.users` profile already holds the required organization, role, and status:

```text
auth.users
  id, email, password and invitation state     -- Supabase-managed

public.users
  id = auth.users.id
  organization_id                              -- immutable for this module
  role = ADMIN | MARKETING_USER
  status = active | disabled
```

The implementation adds only the user-management audit-action values required to distinguish
invite, role change, disable, and reactivate events. Audit records use the existing
`audit_logs` shape: actor ID, actor organization ID, target user as the resource, and relevant
before/after values. Passwords, invitation URLs, tokens, service-role credentials, and raw Auth
provider responses are never stored in audit data.

Routes introduced by the implementation are:

- `Settings > Users`: the protected ADMIN-only management page.
- An auth callback route: consumes the Supabase invitation return and establishes the recipient
  session.
- A password-setup route: available only after that callback has established the invited user's
  session; it collects and submits the recipient's chosen password.

## Authorization and Invariants

The server action is authoritative. Hiding controls from non-ADMINs is necessary for the UI, but
it is not authorization.

| Invariant | Enforcement |
| --- | --- |
| Only active ADMINs manage users | Route and every action load `getCurrentUser()` and require `isActive(profile)` plus `isAdmin(profile)`. Unauthenticated callers follow the existing login handling; authenticated but unauthorized callers receive no successful mutation. |
| An ADMIN manages only their organization | All target lookups, list queries, updates, and active-ADMIN counts include the actor's organization ID. The target must be found within that scope before any action. |
| No self-disable | Disable rejects `targetUserId === actor.id`. |
| At least one active ADMIN remains | Before disabling an active ADMIN or changing an active ADMIN to `User`, count active ADMIN profiles in that organization. Reject the action when the target is the last one. |
| Disabled profiles cannot manage users | The action authorization check rejects the caller before it evaluates requested changes. |
| No delete path | The module exposes no delete action and does not call Auth or database deletion for an existing managed user. The only Auth deletion is compensation for a newly created identity whose profile could not be created. |
| No cross-tenant inference | Not-found and out-of-organization targets produce the same safe failure response; the UI does not reveal whether an email or user exists elsewhere. |

The last-active-ADMIN check must execute in the same protected mutation path as the role/status
write, using database-safe concurrency control so simultaneous ADMIN actions cannot both pass the
check and leave the organization without an active ADMIN.

## Invite Flow

### Invite

1. The ADMIN submits an email and V1 role. Zod normalizes and validates the email and accepts only
   `ADMIN` or `User`; the server maps `User` to `MARKETING_USER`.
2. The server authorizes the actor, applies the mutation rate limit, and checks the email against
   application profiles in the actor's organization before provisioning.
3. Through the server-only service-role client, the provisioning service creates a Supabase Auth
   identity and requests Supabase's email invitation with the approved callback redirect URL. No
   temporary password is generated or handled.
4. The service creates `public.users` with the returned Auth ID, the actor's current organization
   ID, selected role, and `active` status.
5. If profile creation fails after a new Auth identity was created, the service deletes that new
   Auth identity as compensation, returns a failure, and writes no successful invite audit event.
6. After both records exist, the action appends the invite audit event and revalidates the Users
   page.
7. The recipient opens the Supabase email link. The callback exchanges the code for a session and
   redirects to password setup. The password-setup action validates the chosen password and uses
   the authenticated server client to update it. On success it redirects into the protected app.

The provisioning service must return a failure if it cannot establish both the Auth identity and
the profile. It must never report a partial invitation as successful.

## Role and Status Lifecycle

| Operation | Valid outcome |
| --- | --- |
| Invite | Creates an `active` profile with role `ADMIN` or `MARKETING_USER`; invitation acceptance remains Auth state. |
| Change role | Switches only between `ADMIN` and `MARKETING_USER`; demoting the final active ADMIN is rejected. |
| Disable | Changes an eligible target from `active` to `disabled`; self-disable and disabling the final active ADMIN are rejected. |
| Reactivate | Changes a target from `disabled` to `active`; it does not create an identity or profile. |

Disabled users retain their profile and organization membership. Authentication and protected-route
access continue to respect the existing active-profile gate, so reactivation restores access
without changing their Auth identity or password.

## Error Handling

| Condition | Result |
| --- | --- |
| Missing session | Follow existing login redirect behavior; perform no mutation. |
| Non-ADMIN or disabled actor | Reject server-side; perform no privileged provider call or audit success event. |
| Invalid form data | Return a structured validation failure without a mutation. |
| Rate limit exceeded | Return a safe, retryable failure without calling Supabase Auth. |
| Target absent from actor organization | Return the same safe failure used for a missing target. |
| Duplicate or incompatible invite request | Do not create an additional Auth identity or profile; return a safe failure. |
| Auth invite failure | Do not create the profile; return a safe failure. |
| Profile creation failure after Auth creation | Attempt Auth identity deletion as compensation; report failure. If compensation itself fails, log enough server-side operational detail for remediation without exposing credentials or tokens to the caller. |
| Last active ADMIN or self-disable | Reject before mutation and state the actionable constraint in the UI. |
| Callback or password update failure | Keep the user out of protected content until a valid session and password setup complete; show a retry-safe failure without exposing token details. |

## Audit and Testing

Audit events cover successful invite, role change, disable, and reactivate
operations. Each records the actor, organization, target resource, and non-sensitive before/after
role or status values where applicable. Failed attempts are not represented as successful audit
events.

Focused Vitest tests cover the server-action boundary with mocked Auth/service dependencies:

- Non-ADMIN and disabled callers cannot list or mutate users.
- Every target operation is constrained to the actor's organization.
- Zod rejects invalid email, role, and target inputs; `User` maps to `MARKETING_USER`.
- Invite creates profile membership only after Auth identity provisioning; profile failure invokes
  compensation cleanup.
- Self-disable and the final-active-ADMIN disable/demotion are rejected, including the
  concurrency-safe service contract.
- Disable/reactivate and role changes write the expected audit payload and revalidate the Users
  route only after a successful mutation.
- Callback/password setup rejects missing or invalid invitation session state and updates the
  password only through the authenticated server boundary.

## Production Prerequisites

Before deployment, configure the Supabase Auth redirect URL allow list with the production auth
callback URL used by this module. Configure the equivalent local/development callback URL for
development. The invitation's `emailRedirectTo` value must be an allowed URL and must lead to the
callback route, which then owns the transition to password setup.

The deployed environment must also provide `SUPABASE_SERVICE_ROLE_KEY` only to server runtime
code. It must never be prefixed with `NEXT_PUBLIC_`, returned to the browser, or imported from a
Client Component.

## Review Checklist

- [x] UI and server actions both require active ADMIN authorization.
- [x] All reads and writes are scoped to the actor's organization.
- [x] Invitations create Auth identity plus profile membership, with compensation on profile
  failure.
- [x] The final active ADMIN and self-disable invariants are enforced.
- [x] Only `ADMIN` and `User` are exposed in V1.
- [x] Password setup follows the Supabase invitation callback and uses no temporary password.
- [x] Audit, rate-limit, validation, revalidation, focused Vitest tests, and Supabase redirect
  configuration are included.
