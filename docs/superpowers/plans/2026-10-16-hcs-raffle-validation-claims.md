# HCS Raffle Validation and Claims Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD. Do not commit; the user explicitly requested an uncommitted worktree.

**Goal:** Add organization-scoped HCS raffle validation and claim endpoints without creating Hub users or implementing resend.

**Architecture:** Preserve Hub actor UUID columns and behavior, adding nullable external HCS actor fields for HCS mutations and audit records. Keep route handlers thin; put attendee-code lookup, lifecycle checks, atomic claim transitions, and idempotency behavior in services.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Zod, Vitest, Drizzle ORM/PostgreSQL.

## Global Constraints

- HCS authentication uses `authenticateHcsRequest` and `X-HCS-Company-Id`.
- HCS actor headers are required for mutation/audit metadata and are not Hub users.
- Responses must be generic and must not expose attendee PII.
- Claims require matching `Idempotency-Key` header/body and connection-scoped replay.
- No resend implementation and no commit.

### Task 1: Service and route RED tests

**Files:**
- Create/modify: `src/modules/raffles/service.test.ts`
- Create: `app/api/integrations/hcs/events/[eventId]/raffle/validate/route.test.ts`
- Create: `app/api/integrations/hcs/events/[eventId]/raffle/claims/route.test.ts`

- [ ] Add failing service tests for external actor claims, scoped code lookup, lifecycle conflicts, exact idempotent replay, mismatched idempotency, and concurrent claim serialization.
- [ ] Add failing route tests for headers, Zod body validation, minimal validation output, generic errors, and exact claim response.
- [ ] Run the focused tests and confirm they fail because the new APIs do not exist.

### Task 2: Persistence and service GREEN implementation

**Files:**
- Modify: `src/modules/raffles/db.ts`
- Modify: `src/modules/raffles/service.ts`
- Modify: `src/modules/integrations/service.ts` only if atomic idempotency support requires a helper
- Create: next Drizzle migration under `drizzle/`

- [ ] Add nullable external claimant/audit actor/source columns while preserving existing Hub columns.
- [ ] Implement discriminated actor input and scoped attendee/draw lookups.
- [ ] Implement HCS validate projection and atomic claim mutation with revealed/deadline/invalidation/claimed checks.
- [ ] Add connection-scoped idempotency reservation/replay that prevents double accreditation under concurrent requests.
- [ ] Run service tests to green and preserve existing raffle tests.

### Task 3: HTTP routes GREEN implementation

**Files:**
- Create: `app/api/integrations/hcs/events/[eventId]/raffle/validate/route.ts`
- Create: `app/api/integrations/hcs/events/[eventId]/raffle/claims/route.ts`
- Modify: existing HCS raffle capability route if needed to keep resend disabled

- [ ] Authenticate and require actor headers.
- [ ] Parse request bodies with Zod and enforce idempotency header/body equality for claims.
- [ ] Map service errors to 400/401/403/404/409/429 with generic bodies.
- [ ] Return only the contracted fields and external actor id on successful claims.
- [ ] Run route tests to green.

### Task 4: Verification

- [ ] Run focused raffle/integration tests.
- [ ] Run full typecheck.
- [ ] Run Drizzle schema check/generation validation without applying migrations.
- [ ] Run lint.
- [ ] Inspect `git diff` and report changed files and limitations without committing.
