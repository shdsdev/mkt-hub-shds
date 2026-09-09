# Design: Phase 9 — Security + Audit

## Context

`docs/ROADMAP.md` Phase 9: `audit_logs` wiring, rate limiting, CSRF/XSS/SQLi protections, secure
cookies, brute-force protection. Most of the generic security posture already exists from Phase 1:
account-level lockout, Supabase Auth's own per-IP rate limiting/CAPTCHA, HttpOnly/Secure/SameSite
cookies, Zod validation everywhere, Drizzle parameterized queries (no SQL injection surface),
React's default XSS escaping (no `dangerouslySetInnerHTML` anywhere). What's genuinely missing:
the `audit_logs` table itself, wiring audit capture into mutations, an audit log viewer, and rate
limiting on non-auth mutation endpoints (today only login has any throttling).

## Scope

**In**: `audit_logs` table, a generic `recordAudit()` helper called from every mutating server
action (not a DB trigger — keeps audit logic in application code, not coupled to schema), a generic
in-memory rate limiter applied to all mutation actions, an Audit Log viewer page.

**Out**: re-auditing/re-verifying Phase 1's already-built protections (lockout, cookies, Supabase
Auth's CAPTCHA/rate-limiting) — those exist and are correct, this phase adds what's missing, not
redundant coverage.

## `audit_logs` (`src/modules/audit/db.ts`)

```
id               uuid PK
organization_id  uuid FK -> organizations
user_id          uuid FK -> auth.users (reference-only declaration, like users/db.ts's authUsers)
action           audit_action enum (create, destination_change, archive, end_campaign, record_print_run)
resource_type    text (link, short_link, qr_code, campaign, domain, print_run, utm_preset)
resource_id      uuid
before           jsonb (nullable — only populated for destination_change)
after            jsonb (nullable — populated for create/destination_change, null for archive/end)
created_at       timestamptz NOT NULL default now()
```

Append-only in application code (no update/delete function exists), matching the `print_runs`
pattern from Phase 6. `action = 'destination_change'` satisfies `DATABASE.md`'s explicit
requirement to capture before/after `destination_url`.

`recordAudit()` is called directly from each mutating server action (in `app/(protected)/*/actions.ts`,
after the module-level mutation succeeds) rather than every module's service function — keeps the
audit module's public surface small (one function) and keeps "what counts as an auditable user
action" a UI-layer decision, not baked into every module.

## Rate Limiting

`src/modules/audit/rate-limit.ts` (or a `lib` helper, since it has no persistence — pure in-memory
state) — a generic sliding-window limiter keyed by user id, 30 actions/minute, reused across every
mutating server action. Same architectural justification as the Phase 3 tracking buffer: valid
in-memory state because the deployment is one persistent container. Returns a boolean; actions
that exceed the limit return a generic "too many requests, try again shortly" error instead of
mutating.

## UI

New "Audit Log" sidebar item (own entry, not folded into the disabled "Settings" placeholder —
audit history isn't configuration). A table: action, resource type, who, when, expandable row for
the before/after diff when present.

## Testing

TDD on the two pieces of pure logic: the rate limiter's sliding-window accept/reject behavior
(fake timers, matching the Phase 3 buffer test pattern) and the audit-entry shape builder (given a
mutation's before/after values, produce the correct `audit_logs` insert payload). Verified against
the live local Supabase stack and, since the Chrome extension is connected this session, a real
browser click-through: trigger several mutations, confirm they appear correctly in the Audit Log
UI with accurate before/after data.

## Open Questions

None.
