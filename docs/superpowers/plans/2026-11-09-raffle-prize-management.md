# Raffle Prize Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe prize deletion and per-prize winner-email control with draw-level snapshots that preserve history and prevent accidental sends.

**Architecture:** Keep authorization in server actions and domain invariants in `src/modules/raffles/service.ts`. Add nullable-free boolean fields to prize and draw rows, generated through a Drizzle migration. Use the draw snapshot for confirmation/resend behavior and retain existing audit/history rows.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM/PostgreSQL, Zod, React server actions, Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-11-09-raffle-prize-management-design.md`

## Global Constraints

- Delete only when no `raffle_draws` row exists for the prize, including invalidated/unclaimed history.
- Delete requires explicit confirmation in the UI.
- Email is enabled by default per prize and may change only without a pending draw.
- Every draw snapshots the prize email setting; later changes are non-retroactive.
- Email failure never undoes winner confirmation.
- Resend is unavailable for draws whose email snapshot is disabled.
- Preserve existing raffle authorization, event scoping, exclusion, absence, and unresolved-draw rules.

## Review Focus

- A prize with `drawnQuantity = 0` but an invalidated draw must still be undeletable; test in Task 2.
- A stale toggle request must not change a prize while a pending draw exists; test in Task 2.
- A draw created before a toggle change must keep its original email behavior; test in Task 2.
- A failed email provider must leave the draw claimed and retryable only when its snapshot is enabled; test in Task 3.
- Missing/false form confirmation must not delete a prize; test in Task 4.

---

### Task 1: Persist prize email configuration and draw snapshot

**Files:**
- Create: `drizzle/0079_<generated-name>.sql`
- Modify: `src/modules/raffles/db.ts`
- Test: `src/modules/raffles/db.test.ts`

**Interfaces:**
- Produces `rafflePrizes.sendWinnerEmail: boolean` and `raffleDraws.sendWinnerEmail: boolean`.

- [ ] **Step 1: Write failing schema assertions** for both fields, including default `true` and non-null semantics.
- [ ] **Step 2: Run** `pnpm exec vitest run src/modules/raffles/db.test.ts`; verify the assertions fail because fields are absent.
- [ ] **Step 3: Add** the two Drizzle boolean columns and a migration that adds both PostgreSQL columns with default `true` and backfills existing rows.
- [ ] **Step 4: Run** the schema test and verify it passes.
- [ ] **Step 5: Run** `pnpm db:generate` only if the repository convention requires generated metadata; inspect the diff and retain the migration as the only database change.

### Task 2: Add domain operations and snapshot behavior

**Files:**
- Modify: `src/modules/raffles/service.ts`
- Modify: `src/modules/raffles/index.ts`
- Test: `src/modules/raffles/service.test.ts`

**Interfaces:**
- `deletePrize(input: { eventId: string; organizationId: string; raffleId: string; prizeId: string; actor: RaffleActor }): Promise<void>`
- `updatePrizeEmailSetting(input: { eventId: string; organizationId: string; raffleId: string; prizeId: string; sendWinnerEmail: boolean; actor: RaffleActor }): Promise<RafflePrizeRow>`
- `confirmDrawAndNotify` reads `draw.sendWinnerEmail`.
- `resendHcsWinnerEmail` rejects when `draw.sendWinnerEmail` is false.

- [ ] **Step 1: Add failing service tests** for successful deletion before any draw, rejection after an invalidated draw, toggle rejection with a pending/revealed draw, snapshot at draw creation, no-email confirmation, and resend rejection for disabled snapshots.
- [ ] **Step 2: Run** `pnpm exec vitest run src/modules/raffles/service.test.ts`; verify each new test fails for the intended missing behavior.
- [ ] **Step 3: Implement** locked, scoped transactional deletion: select raffle/prize, lock raffle/prize, query `raffle_draws` by prize, reject if any row exists, delete prize, and write the existing `prize_change` audit event.
- [ ] **Step 4: Implement** locked, scoped email-setting update; reject if any event draw is `pending_reveal` or `revealed`, update the prize, and audit the change.
- [ ] **Step 5: Copy** `prize.sendWinnerEmail` into `raffleDraws.sendWinnerEmail` in `drawPrizeUnit`.
- [ ] **Step 6: Branch** confirmation and resend from the draw snapshot; do not call the notification service when disabled, while preserving claimed status and existing failure handling.
- [ ] **Step 7: Run** the service tests and verify all pass.

### Task 3: Expose safe server actions

**Files:**
- Modify: `app/(protected)/events/[id]/raffle/actions.ts`
- Modify: `app/(protected)/events/[id]/raffle/actions.test.ts`

**Interfaces:**
- `deletePrizeAction(formData: FormData): Promise<RaffleActionState>` requires `eventId`, `raffleId`, `prizeId`, and `confirmation === "delete"`.
- `updatePrizeEmailAction(formData: FormData): Promise<RaffleActionState>` requires `eventId`, `raffleId`, `prizeId`, and boolean `sendWinnerEmail`.

- [ ] **Step 1: Add failing action tests** for permission denial, missing delete confirmation, successful delete, toggle parsing, and domain error messages.
- [ ] **Step 2: Run** the action test file and verify the new tests fail.
- [ ] **Step 3: Implement** authorization, Zod parsing, actor propagation, `revalidatePath`, and Spanish success/error messages consistent with existing actions.
- [ ] **Step 4: Update** claim/resend action handling so disabled snapshots never expose a resend path.
- [ ] **Step 5: Run** `pnpm exec vitest run "app/(protected)/events/[id]/raffle/actions.test.ts"` and verify it passes.

### Task 4: Update prize management UI

**Files:**
- Modify: `app/(protected)/events/[id]/raffle/raffle-management.tsx`
- Test: `app/(protected)/events/[id]/raffle/raffle-management.test.tsx` if the repository has a component test setup; otherwise cover rendering helpers through action/service tests and perform a build check.

**Interfaces:**
- Prize cards consume `RafflePrizeRow.sendWinnerEmail` and the event draw list.
- Existing checkbox/dropdown visual treatments remain unchanged.

- [ ] **Step 1: Add a focused failing UI test or a render-level assertion** for the default email label, disabled toggle while a pending draw exists, delete confirmation, and email-dependent confirmation/resend labels.
- [ ] **Step 2: Run** the focused UI test and verify it fails.
- [ ] **Step 3: Add** a per-prize email checkbox/switch with accessible text, `Correo activado` / `Entrega presencial · Sin correo` status, and disabled state when unresolved draws exist.
- [ ] **Step 4: Add** a delete button visible only for prizes with no draw history, using an explicit confirmation dialog before submitting `deletePrizeAction`; show the server rejection if state is stale.
- [ ] **Step 5: Change** pending and historical draw actions to use the draw snapshot: `Confirmar y enviar correo` when enabled, `Confirmar ganador` when disabled, and hide `Reenviar correo` when disabled.
- [ ] **Step 6: Run** focused tests, then `pnpm typecheck` and the targeted ESLint command.

### Task 5: Full verification and migration review

**Files:**
- Modify only if verification exposes an issue.

- [ ] **Step 1: Run** `pnpm exec vitest run src/modules/raffles "app/(protected)/events/[id]/raffle/actions.test.ts"`; expect all targeted tests to pass.
- [ ] **Step 2: Run** `pnpm typecheck`; expect exit code 0.
- [ ] **Step 3: Run** ESLint on all changed TypeScript/TSX files; expect no output/errors.
- [ ] **Step 4: Run** `pnpm build`; expect production compilation and static generation to complete.
- [ ] **Step 5: Run** `git diff --check` and inspect the migration for safe defaults, organization scoping, and no destructive history deletion.
