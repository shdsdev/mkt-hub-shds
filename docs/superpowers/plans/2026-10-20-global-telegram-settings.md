# Global Telegram Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add organization-scoped Telegram destination settings and an admin UI while keeping the bot token in the environment.

**Architecture:** Add `telegram_settings` to the notifications module, expose organization-scoped service functions, and extend the existing Integrations page/actions. Notification senders resolve event chat first and global organization chat second.

**Tech Stack:** Next.js 16 App Router, React 19 server actions, Drizzle ORM/PostgreSQL, Zod, Vitest, Tailwind CSS.

## Global Constraints

- Keep `TELEGRAM_BOT_TOKEN` in environment configuration; never persist or render it.
- Require an active ADMIN for all Telegram settings mutations.
- Preserve the existing event-level `telegramChatId` fallback and non-blocking notification behavior.
- Use existing `Button`, form, card, and status-message patterns.
- Do not modify unrelated settings or registry files.

---

### Task 1: Add Telegram settings persistence

**Files:**
- Modify: `src/modules/notifications/db.ts`
- Modify: `src/db/schema.ts`
- Create: `src/modules/notifications/service.ts`
- Create: `src/modules/notifications/service.test.ts`
- Create: `drizzle/0045_fearless_omega_red.sql`

**Interfaces:**
- `getTelegramSettings(organizationId: string): Promise<TelegramSettings | undefined>`
- `upsertTelegramSettings(input: { organizationId: string; chatId: string | null; enabled: boolean }): Promise<TelegramSettings>`

- [ ] Add `telegramSettings` with `id`, `organizationId`, `chatId`, `enabled`, `createdAt`, and `updatedAt`, plus a unique organization constraint.
- [ ] Export the table through `notificationsTables` and `src/db/schema.ts`.
- [ ] Implement organization-scoped read/upsert using `onConflictDoUpdate`.
- [ ] Add migration SQL with the unique organization index and foreign key.
- [ ] Test isolation and upsert behavior with the existing database test conventions.
- [ ] Run `pnpm typecheck` and the focused notifications tests.

### Task 2: Add authenticated Telegram server actions

**Files:**
- Modify: `app/(protected)/settings/integrations/actions.ts`
- Modify: `app/(protected)/settings/integrations/actions.test.ts`

**Interfaces:**
- `saveTelegramSettingsAction(_state, formData): Promise<TelegramIntegrationActionState>`
- `sendTelegramTestMessageAction(_state): Promise<TelegramIntegrationActionState>`

- [ ] Add Zod validation for `chatId` and `enabled`.
- [ ] Reuse `requireActiveAdmin` and return the existing permission error for unauthorized calls.
- [ ] Save the organization row and revalidate `/settings/integrations`.
- [ ] Send a short test message through `sendTelegramMessage` using `env.TELEGRAM_BOT_TOKEN`.
- [ ] Return safe success/error messages without exposing credentials.
- [ ] Test unauthorized, invalid, save, and Telegram failure paths.

### Task 3: Extend the Integrations UI

**Files:**
- Modify: `app/(protected)/settings/integrations/page.tsx`
- Modify: `app/(protected)/settings/integrations/hcs-integrations.tsx`
- Modify: `app/(protected)/settings/integrations/page.test.tsx` if present, otherwise create it

**Interfaces:**
- `HcsIntegrations` receives `telegramSettings` in addition to `connections`.

- [ ] Load HCS connections and Telegram settings in parallel from the server page.
- [ ] Add a Telegram card with status, chat ID input, enabled checkbox, save action, and test action.
- [ ] Use `useActionState` for both actions and disable buttons while pending.
- [ ] Provide visible status text and accessible error/live regions.
- [ ] Preserve mobile layout and existing HCS behavior.
- [ ] Test initial values, labels, and state feedback.

### Task 4: Resolve global Telegram destination for notifications

**Files:**
- Modify: `app/events/[id]/actions.ts`
- Modify: `app/(protected)/events/[id]/registrations/actions.ts`
- Modify: corresponding action tests
- Modify: `src/modules/notifications/index.ts`

- [ ] Resolve event-level `telegramChatId` first.
- [ ] If absent, load enabled organization settings using the event organization ID.
- [ ] Skip Telegram when neither destination is configured.
- [ ] Keep sends fire-and-forget so Telegram failure does not fail registration or review decisions.
- [ ] Test event override, global fallback, disabled settings, and no destination.

### Task 5: Verify the complete change

**Files:**
- No additional source files.

- [ ] Run focused Telegram and Integrations tests.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Review `git diff` and confirm no registry/config files were changed.
