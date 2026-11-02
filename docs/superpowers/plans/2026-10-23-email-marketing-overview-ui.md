# Email Marketing Overview UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Email Marketing overview hierarchy by removing repeated card containers and making campaigns the primary visual focus.

**Architecture:** Keep the existing server-rendered `EmailMarketingPage` and data flow. Change only its composition and Tailwind classes: compact page header, divider-based navigation, a single summary strip, and flat campaign rows with explicit status treatment.

**Tech Stack:** Next.js App Router, React Server Components, Tailwind CSS, existing Link and design tokens.

## Global Constraints

- Preserve the existing dark visual language and shared spacing/color tokens.
- Do not invent metrics: keep unavailable contact and next-send values honest.
- Keep responsive behavior for mobile and desktop.
- Keep status understandable through text, not color alone.
- Do not add new dependencies or change data models.

---

### Task 1: Recompose the Email Marketing overview

**Files:**
- Modify: `app/(protected)/email-marketing/page.tsx:22-101`

**Interfaces:**
- Consumes: existing `campaigns` data and `statusLabels` map.
- Produces: the same server page and links with a flatter visual hierarchy.

- [x] **Step 1: Replace the bordered hero card**

Use a plain header with a compact eyebrow, title, description, primary action, and a bottom divider. Preserve the existing routes and copy.

- [x] **Step 2: Convert navigation into a divider-based tab row**

Keep `Campañas`, `Contactos`, and `Segmentos`, but remove individual pill borders from inactive links. Use an active underline/background treatment with visible focus states.

- [x] **Step 3: Convert metrics into one summary strip**

Use one border-bottom/border-top region with three columns and internal dividers. Keep `--` for unavailable values and preserve the current explanatory detail text.

- [x] **Step 4: Make the campaign library the main surface**

Remove the outer card around the library. Keep the section heading and render campaign rows as flat list items separated by borders. Keep campaign name, subject, and status label. Ensure the status remains textually explicit.

- [x] **Step 5: Preserve the empty state**

Keep the empty-state message and action, but present it as a clean dashed region without adding another nested card.

### Task 2: Verify the visual composition

**Files:**
- Test: existing project lint/typecheck commands.

**Interfaces:**
- Consumes: updated `EmailMarketingPage`.
- Produces: verified TypeScript and ESLint output.

- [x] **Step 1: Run lint**

Run `pnpm lint` and expect exit code 0.

- [x] **Step 2: Run typecheck**

Run `pnpm typecheck` and expect exit code 0.

- [x] **Step 3: Run the relevant test suite**

Run `pnpm test` and record the passing test count plus any pre-existing jsdom warnings.
