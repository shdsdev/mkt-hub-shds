# HCS Raffle Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, tenant-scoped HCS raffle winner-email resend endpoint with durable notification state, audit records, retries, rate limiting, and exact idempotent responses.

**Architecture:** Keep the HTTP handler thin and follow existing HCS authentication/error patterns. Add a raffle service operation that locks and scopes the draw, persists a distinct raffle-draw notification record, invokes the existing Resend configuration/client pattern, records provider outcome and audit metadata, and is executed through `runIdempotentResponse`. Authenticated replays return the stored response; only new executions consume the connection+actor rate-limit window.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Zod, Drizzle ORM/Postgres, Vitest, existing Resend integration/configuration.

## Global Constraints

- Do not create Hub users for HCS actors.
- Require `authenticateHcsRequest` and bind body actor identity to `X-HCS-Actor-Id` and `X-HCS-Actor-Email`.
- Scope every draw lookup to `eventId` and the authenticated connection organization.
- Never return attendee email, name, phone, company, or provider details to HCS.
- Use `runIdempotentResponse`; same key and request replay the exact original body, differing payloads return 409, and concurrent retries do not send twice.
- Do not modify existing attendee notification behavior.
- Do not commit.

### Task 1: Lock the route contract with failing tests

**Files:**
- Create: `app/api/integrations/hcs/events/[eventId]/raffle/resend/route.test.ts`
- Create: `app/api/integrations/hcs/events/[eventId]/raffle/resend/route.ts`

**Interfaces:**
- Consumes: `authenticateHcsRequest`, `errorResponse`, `runIdempotentResponse`, raffle resend service, and the existing limiter pattern.
- Produces: `POST(request, { params })` returning only `{ success: true, email: { status: "resent", sentAt: string } }` on success.

- [ ] **Step 1: Write tests for the required route behaviors**
  Cover missing/mismatched idempotency headers, actor mismatch, invalidated draw 409, 404 draw scope, provider failure followed by retry, manual resend, 429 rate limit, exact replay, payload mismatch 409, and response JSON with no attendee PII.
- [ ] **Step 2: Run the new route test and verify it fails for the missing endpoint/service behavior**
  Run `pnpm vitest run app/api/integrations/hcs/events/[eventId]/raffle/resend/route.test.ts`.
- [ ] **Step 3: Implement the minimal route validation and delegation**
  Parse `{ drawId, actor, reason, idempotencyKey }` with Zod, compare both trusted headers, map service errors to generic statuses, and pass the canonical request into idempotency handling.
- [ ] **Step 4: Run the route test and verify the route-level cases pass**
  Run the same focused Vitest command.

### Task 2: Add durable raffle-draw notification persistence

**Files:**
- Modify: `src/modules/raffles/db.ts`
- Modify: `src/db/schema.ts` if shared schema exports are required
- Create: `drizzle/0034_hcs_raffle_resend.sql`
- Create: matching `drizzle/meta/0034_snapshot.json` and update `drizzle/meta/_journal.json` through Drizzle generation
- Test: `src/modules/raffles/db.test.ts` or the focused service tests

**Interfaces:**
- Produces: a notification table/type with raffle-draw subject/type, `sent|failed|resent|unknown` status, recipient/provider metadata, timestamps, reason, and draw/organization/event foreign keys without changing attendee notification rows.

- [ ] **Step 1: Add failing schema/service assertions for a separate raffle-draw notification type and statuses**
- [ ] **Step 2: Run the focused schema/service test and verify it fails**
- [ ] **Step 3: Add the Drizzle table/type and migration using the repository’s existing notification conventions**
- [ ] **Step 4: Run `pnpm drizzle-kit check` and the focused tests**

### Task 3: Implement the service resend operation test-first

**Files:**
- Modify: `src/modules/raffles/service.ts`
- Modify: `src/modules/raffles/index.ts`
- Modify: existing Resend client/config module identified during implementation
- Modify: `src/modules/audit` action typing/insertion if needed
- Test: `src/modules/raffles/service.test.ts`

**Interfaces:**
- Consumes: `{ drawId, eventId, organizationId, connectionId, actor, reason }`.
- Produces: `{ status: "resent", sentAt: Date }`, while persisting `unknown` before provider uncertainty, `failed` on provider error, `sent` for first successful send, and `resent` for successful retry/manual resend.

- [ ] **Step 1: Write failing service tests for tenant scoping, invalidation, manual resend, failure/retry, HTML escaping, audit metadata, and provider result persistence**
- [ ] **Step 2: Run `pnpm vitest run src/modules/raffles/service.test.ts` and verify the new tests fail for missing behavior**
- [ ] **Step 3: Implement locked draw lookup and notification state transitions**
  Use the stored attendee email only as the provider recipient; never include it in the returned value or route response.
- [ ] **Step 4: Implement the existing Resend client/configuration call with HTML escaping for every dynamic HTML value**
- [ ] **Step 5: Add raffle audit action `resend_request` with actor, timestamp, reason, and provider result metadata**
- [ ] **Step 6: Run the service tests and verify they pass**

### Task 4: Integrate rate limiting and idempotency concurrency

**Files:**
- Modify: `src/modules/audit/rate-limit.ts` or add a focused connection+actor limiter export
- Modify: `src/modules/integrations/service.ts` only if idempotent error mapping requires it
- Modify: `app/api/integrations/hcs/events/[eventId]/raffle/resend/route.ts`
- Test: `app/api/integrations/hcs/events/[eventId]/raffle/resend/route.test.ts`

**Interfaces:**
- Produces: rate-limit key `hcs-raffle-resend:${connection.id}:${actor.userId}` and 429 for new executions; replayed idempotent responses remain available after authentication and validation.

- [ ] **Step 1: Add failing tests for 429 and replay bypass behavior**
- [ ] **Step 2: Run the focused route test and verify those tests fail**
- [ ] **Step 3: Apply the limiter only inside the non-replayed execution path**
- [ ] **Step 4: Preserve `runIdempotentResponse` as the single reservation/response mechanism**
- [ ] **Step 5: Run focused route and service tests**

### Task 5: Update capability response and verify the complete change

**Files:**
- Modify: `app/api/integrations/hcs/events/[eventId]/raffle/route.ts`
- Modify: `app/api/integrations/hcs/events/[eventId]/raffle/route.test.ts`

- [ ] **Step 1: Add a failing assertion that `canResend` is true only in the implemented raffle response**
- [ ] **Step 2: Update the GET response and test**
- [ ] **Step 3: Run focused tests for all touched HCS and raffle files**
- [ ] **Step 4: Run `pnpm typecheck`**
- [ ] **Step 5: Run `pnpm drizzle-kit check`**
- [ ] **Step 6: Run `pnpm lint`**
- [ ] **Step 7: Inspect `git diff` and `git status --short`; confirm no commit was created and unrelated changes remain untouched**
