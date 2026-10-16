# HCS Pairing Exchange Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the HCS pairing exchange response and connection persistence with the exact backend-to-backend contract.

**Architecture:** Keep the route thin and organization-scoped, pass the validated external requester through the existing exchange service, and persist only requester identity fields plus opaque token material. Add the schema migration through the existing Drizzle migration chain.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Zod, Vitest, Drizzle ORM/PostgreSQL.

## Global Constraints

- Do not create a Hub user for the external requester.
- Do not persist or log raw pairing codes or access tokens.
- Preserve existing pairing credential authentication and organization scoping.
- Do not commit changes.

---

### Task 1: Add failing contract tests

**Files:**
- Modify: `src/modules/integrations/service.test.ts`
- Modify: `app/api/integrations/hcs/pairing/exchange/route.test.ts`
- Modify: `src/modules/integrations/db.test.ts`

- [ ] Add service assertions that `requestedBy` is accepted and included in the inserted connection values.
- [ ] Change the route success assertion to the exact flat response shape and assert requester fields are passed through.
- [ ] Add schema assertions for both requester columns.
- [ ] Run the focused tests and confirm they fail because production code does not yet satisfy the contract.

### Task 2: Implement requester persistence and response contract

**Files:**
- Modify: `src/modules/integrations/db.ts`
- Modify: `src/modules/integrations/service.ts`
- Modify: `app/api/integrations/hcs/pairing/exchange/route.ts`

- [ ] Add nullable `text` columns mapped as `hcsRequestedByUserId` and `hcsRequestedByEmail`.
- [ ] Extend `exchangePairingCode` input with `requestedBy` and persist it in the same transaction as the connection.
- [ ] Pass the validated route requester to the service.
- [ ] Return only `connectionId`, `marketingHubOrganizationId`, `organizationName`, `accessToken`, and `expiresAt`.

### Task 3: Add migration metadata and verify

**Files:**
- Create: `drizzle/<generated-migration>.sql`
- Create: `drizzle/meta/<generated-snapshot>.json`
- Modify: `drizzle/meta/_journal.json`

- [ ] Generate the Drizzle migration from the updated schema.
- [ ] Run focused integration tests.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm drizzle-kit check`.
- [ ] Confirm no raw code/token values appear in persistence or logs and inspect the final diff for unrelated files.
