# Email Campaign Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow draft campaigns to be edited in place and allow any campaign except an active send to be duplicated safely as a new draft.

**Architecture:** Keep the existing campaign schema and block editor. Add organization-scoped service methods and server actions for update/duplicate, pass persisted campaign content into the wizard, and use a Mailchimp-style campaign management view for status and actions.

**Tech Stack:** Next.js App Router, React, Drizzle, Zod, Tailwind CSS, Vitest.

## Global Constraints

- Only `draft` campaigns can be edited in place.
- `scheduled`, `sending`, `sent`, `cancelled`, and `failed` campaigns can be duplicated as drafts.
- Duplicates never copy scheduled dates, recipient snapshots, delivery state, or statistics.
- Every read and mutation must be scoped to the current organization and admin role.
- Do not add a send button while the worker is not implemented.

---

### Task 1: Campaign persistence and actions

**Files:** `src/modules/email-marketing/service.ts`, `src/modules/email-marketing/index.ts`, `app/(protected)/email-marketing/campaigns/actions.ts`

- [x] Add organization-scoped `updateEmailCampaign` and `duplicateEmailCampaign` service methods.
- [x] Validate editable status in the service and action layer.
- [x] Add `updateEmailCampaignAction` and `duplicateEmailCampaignAction` with audit entries and revalidation.
- [x] Ensure duplicate content is copied while schedule and delivery state reset.

### Task 2: Load campaigns into the editor

**Files:** `app/(protected)/email-marketing/campaigns/new/page.tsx`, `app/(protected)/email-marketing/campaigns/new/email-marketing-wizard.tsx`, `app/(protected)/email-marketing/campaigns/[id]/page.tsx`

- [x] Pass an optional campaign to the wizard.
- [x] Convert stored block documents back into editor blocks without losing styles, links, levels, or nested columns.
- [x] Load stored HTML documents into HTML mode.
- [x] Submit updates for an existing draft and creates for new campaigns.
- [x] Keep non-draft campaign details read-only with a duplicate action.

### Task 3: Mailchimp-style campaign management

**Files:** `app/(protected)/email-marketing/page.tsx`, `app/(protected)/email-marketing/campaigns/[id]/page.tsx`

- [x] Add filters, sort controls, campaign metadata, and an actions menu.
- [x] Show `Editar` only for drafts and `Duplicar` for every campaign status.
- [x] Render a checklist-style detail page with preview and status-aware actions.

### Task 4: Verification

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Confirm organization isolation and status restrictions in tests or type-safe server paths.
