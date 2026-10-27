# Carbon And Lark Orange Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Carbon and Lark Orange as primary themes that reuse Light and Dark content surfaces while changing only the outer navigation surface.

**Architecture:** Extend the fixed theme registry with two persisted IDs. Carbon inherits Light tokens and overrides the sidebar to charcoal; Lark Orange inherits Dark tokens and overrides the sidebar to white. The profile toggle uses explicit theme pairs.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Keep Light and Dark unchanged.
- Carbon content matches Light; Lark Orange content matches Dark.
- No database migration is needed because theme preferences already store a string ID.
- Preserve existing admin-only theme permissions and color override behavior.

### Task 1: Theme Registry And Toggle Pairing

**Files:**
- Modify: `src/modules/users/theme-registry.ts`
- Modify: `src/modules/users/index.ts`
- Modify: `app/(protected)/layout.tsx`
- Modify: `app/(protected)/sidebar.tsx`

- [x] Add `carbon` and `lark-orange` to the primary registry list.
- [x] Export a helper that maps `light` to `dark`, `dark` to `light`, `carbon` to `lark-orange`, and `lark-orange` to `carbon`.
- [x] Use the helper in the protected layout and update the profile menu prop type/label handling.

### Task 2: Theme Picker

**Files:**
- Modify: `app/(protected)/settings/general/page.tsx`
- Modify: `src/modules/users/theme-registry.test.ts`

- [x] Render the first four themes under “Temas principales”.
- [x] Start secondary themes after index four.
- [x] Test the primary order and swatches.

### Task 3: Surface Tokens

**Files:**
- Modify: `app/globals.css`

- [x] Make Carbon share Light content tokens and override only sidebar tokens to charcoal.
- [x] Make Lark Orange share Dark content tokens and override only sidebar tokens to white with dark text.
- [x] Reuse the matching Light/Dark content-frame border rules.
- [x] Keep the existing responsive shell and mobile navigation behavior intact.

### Task 4: Verification

- [x] Run focused theme tests.
- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run Impeccable detector on changed UI targets.
