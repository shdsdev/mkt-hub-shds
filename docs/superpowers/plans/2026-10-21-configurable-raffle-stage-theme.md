# Configurable Raffle Stage Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow raffle administrators to configure a safe stage background, accent color, and optional logo from the raffle editor, then render those settings on the public stage screen.

**Architecture:** Store three nullable theme fields on `raffles`, normalize them through a small pure module with safe defaults, and expose one authorized server action for updates. A client-side settings component owns the color inputs, existing Supabase logo uploader, and a compact live preview; `StageScreen` receives the persisted theme and maps it to CSS variables.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, PostgreSQL, Tailwind CSS v4, Vitest, Supabase Storage.

## Global Constraints

- Preserve the existing dark Marketing Hub admin UI and public stage behavior.
- Keep all visible copy in Spanish.
- Do not allow arbitrary text colors that can create unreadable combinations; derive foreground colors from the configured background/accent.
- Keep `.atl/*` and `.codex/` out of the change.
- Do not change the raffle draw/confirm API contract.

---

### Task 1: Validate Stage Theme Values

**Files:**
- Create: `src/modules/raffles/stage-theme.ts`
- Test: `src/modules/raffles/stage-theme.test.ts`

**Interfaces:**
- Produces `DEFAULT_RAFFLE_STAGE_THEME`, `normalizeRaffleStageTheme`, and `getReadableStageTextColor` for server and client consumers.

- [x] Write failing tests for valid hex normalization, fallback defaults, and readable black/white foreground selection.
- [x] Run `pnpm test -- src/modules/raffles/stage-theme.test.ts --run` and confirm the expected failures.
- [x] Implement the pure helpers with no database or browser dependencies.
- [x] Run the focused test again and confirm it passes.

### Task 2: Persist Theme Settings

**Files:**
- Modify: `src/modules/raffles/db.ts`
- Modify: `src/modules/raffles/service.ts`
- Modify: `src/modules/raffles/index.ts`
- Create: `drizzle/0048_<generated-name>.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/meta/0048_snapshot.json`

**Interfaces:**
- `RaffleRow` gains `stageBackgroundColor`, `stageAccentColor`, and `stageLogoUrl`.
- `updateRaffleStageTheme(input)` updates the scoped raffle and returns the updated row.
- `getRaffleStageState()` returns a normalized `theme` object to the public screen.

- [x] Add text columns with defaults matching the current stage palette.
- [x] Add an authorized action test covering organization-scoped theme values.
- [x] Implement the scoped update and export it through the raffle module index.
- [x] Run `pnpm db:generate` and inspect the generated migration/journal.
- [x] Run the module tests and typecheck.

### Task 3: Add Authorized Editor Controls

**Files:**
- Modify: `app/(protected)/events/[id]/raffle/actions.ts`
- Modify: `app/(protected)/events/[id]/raffle/actions.test.ts`
- Create: `app/(protected)/events/[id]/raffle/stage-theme-settings.tsx`
- Modify: `app/(protected)/events/[id]/raffle/raffle-management.tsx`
- Modify: `app/(protected)/events/[id]/raffle/page.tsx`

**Interfaces:**
- `updateRaffleStageThemeAction(_state, formData)` accepts `eventId`, `raffleId`, `stageBackgroundColor`, `stageAccentColor`, and `stageLogoUrl`.
- `StageThemeSettings` receives `eventId`, `raffleId`, `organizationId`, and current normalized theme.

- [x] Add a failing action test for authorization and normalized values.
- [x] Implement the authorized server action and revalidate `/events/<id>/raffle`.
- [x] Build the editor with two color inputs, reusable logo upload, helper copy, save state, and a live preview.
- [x] Render the settings section from `RaffleManagement` without changing existing prize actions.
- [x] Run the focused action/UI-adjacent tests and lint.

### Task 4: Render the Configured Public Stage

**Files:**
- Modify: `app/events/[id]/raffle/[token]/stage-screen.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `StageScreen` consumes `initialState.theme` and uses CSS variables for background, accent, foreground, and accent foreground.

- [x] Add a testable normalized theme fallback for old rows with null fields.
- [x] Apply CSS variables to the stage root, winner code, panel, and action button.
- [x] Render the optional logo with an accessible alt label and safe sizing.
- [x] Keep disabled/confirmation states legible under every supported theme.
- [x] Run the stage detector and verify responsive composition through static checks.

### Task 5: Final Verification

**Files:**
- No additional files.

- [x] Run `pnpm exec tsc --noEmit`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test -- --run`.
- [x] Run `pnpm build`.
- [x] Run `git diff --check`.
- [x] Run the Impeccable detector over the changed UI files.
- [x] Confirm `.atl/*` and `.codex/` remain unstaged.
