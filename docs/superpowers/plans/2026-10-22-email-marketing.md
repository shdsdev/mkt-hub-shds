# Email Marketing Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Keep each task independently testable and reviewable. Never include unrelated worktree changes in a commit.

**Goal:** Build an organization-scoped Email Marketing module under the Events experience, using Resend for delivery and preserving the existing Events Editor work.

**Architecture:** Add a bounded `email-marketing` module for contacts, segments, templates, campaigns, recipient snapshots, and delivery state. Keep `notifications` as the Resend-facing leaf and integrate Events only through public module interfaces. The implementation branch is isolated from the main checkout and must rebase onto the latest `dev` before integration.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL/Supabase, Zod, Vitest, Resend HTTP API.

## Global Constraints

- Base branch: `dev`; current integration base: `a7f0ff8 feat(events): add event editor role`.
- Worktree: `C:\Users\javier.enriquez\Desktop\PROYECTOS\MKT\hub mkt-worktrees\email-marketing-mvp`.
- Branch: `feature/email-marketing-mvp`.
- Do not extend `src/modules/campaigns`; it owns QR/link campaigns.
- Outside-module imports may use only another module's `index.ts`.
- Every new table must include `organization_id` and organization-scoped service filters.
- Do not expose Resend secrets to client components or serialized props.
- Do not silently re-subscribe `unsubscribed` or `suppressed` contacts.
- Preserve the existing Event Editor changes; do not revert or rewrite published commits.
- Before integration, rebase onto current `origin/dev`, resolve only intentional conflicts, and run focused tests plus `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Current baseline has pre-existing verification issues: missing `LayoutProps` in `app/layout.tsx` and a test environment requiring `DATABASE_URL`; do not attribute them to this feature without new evidence.

## Coordination Protocol

- The Events agent may continue committing to `dev`.
- Email Marketing work stays in this worktree until a deliberate integration review.
- Do not edit shared Event Editor files while the Events agent is actively changing them.
- Initial work must avoid `src/modules/events`, `app/(protected)/sidebar.tsx`, and Event Editor actions.
- The first integration point must use a small public Events interface and a dedicated commit.
- Keep migration commits ordered and never generate a migration from an outdated `dev` schema after rebasing.
- Do not push from this branch until status, diff, tests, and the target commit range have been reviewed.

## Task 1: Contact Schema and Policy

**Files:**

- Create: `src/modules/email-marketing/db.ts`
- Create: `src/modules/email-marketing/service.ts`
- Create: `src/modules/email-marketing/index.ts`
- Test: `src/modules/email-marketing/service.test.ts`
- Modify: `src/db/schema.ts`
- Create: generated `drizzle/0052_*.sql` and matching snapshot/journal entry

**Deliverable:** Global contacts, event memberships, organization-scoped uniqueness, status enum, email normalization, and consent-preserving policy.

**Verification:**

```text
pnpm vitest run src/modules/email-marketing/service.test.ts
pnpm eslint src/modules/email-marketing src/db/schema.ts
pnpm db:generate
```

## Task 2: Contact Persistence and Event Synchronization

**Files:**

- Modify: `src/modules/email-marketing/db.ts`
- Modify: `src/modules/email-marketing/service.ts`
- Modify: `src/modules/email-marketing/index.ts`
- Test: `src/modules/email-marketing/service.test.ts`
- Test: `src/modules/email-marketing/contact-sync.test.ts`
- Modify only through public integration: `app/events/[id]/actions.ts` and admin registration actions after coordination checkpoint

**Interfaces:**

- Produces `syncEventAttendeeContact(input): Promise<{ contactId: string }>`.
- Input includes organization ID, event ID, attendee ID, profile fields, consent timestamp, and approved event attributes.
- Existing `unsubscribed` and `suppressed` statuses remain unchanged.

**Verification:**

```text
pnpm vitest run src/modules/email-marketing/contact-sync.test.ts app/events/[id]/actions.test.ts
pnpm lint
```

## Task 3: Segments

**Files:**

- Create: `src/modules/email-marketing/segment-schema.ts`
- Modify: `src/modules/email-marketing/db.ts`
- Modify: `src/modules/email-marketing/service.ts`
- Test: `src/modules/email-marketing/segment-schema.test.ts`
- Create: `app/(protected)/email-marketing/segments/page.tsx`
- Create: `app/(protected)/email-marketing/segments/actions.ts`

**Deliverable:** Versioned, allow-listed segment definitions for subscription state, event membership, registration state, interests, brands, and approved attributes. No arbitrary SQL or client-supplied predicates.

**Verification:**

```text
pnpm vitest run src/modules/email-marketing/segment-schema.test.ts
pnpm eslint src/modules/email-marketing app/\(protected\)/email-marketing/segments
```

## Task 4: Block Document and Server Renderer

**Files:**

- Create: `src/modules/email-marketing/content-schema.ts`
- Create: `src/modules/email-marketing/render-email.ts`
- Create: `src/modules/email-marketing/content-schema.test.ts`
- Create: `src/modules/email-marketing/render-email.test.ts`
- Create: `app/(protected)/email-marketing/campaigns/[id]/email-builder.tsx`
- Create: `app/(protected)/email-marketing/campaigns/[id]/email-builder.test.tsx`

**Deliverable:** Versioned block document with text, image, button, divider, columns, and personalization variables. Server-generated HTML must escape user content and accept only HTTPS links.

**Verification:**

```text
pnpm vitest run src/modules/email-marketing/content-schema.test.ts src/modules/email-marketing/render-email.test.ts app/\(protected\)/email-marketing/campaigns/\[id\]/email-builder.test.tsx
```

## Task 5: Campaigns and Recipient Snapshots

**Files:**

- Modify: `src/modules/email-marketing/db.ts`
- Modify: `src/modules/email-marketing/service.ts`
- Create: `src/modules/email-marketing/campaign-state.ts`
- Test: `src/modules/email-marketing/campaign-state.test.ts`
- Create: `app/(protected)/email-marketing/page.tsx`
- Create: `app/(protected)/email-marketing/campaigns/new/page.tsx`
- Create: `app/(protected)/email-marketing/campaigns/actions.ts`
- Create: `app/(protected)/email-marketing/campaigns/campaign-wizard.tsx`

**Deliverable:** Campaign list, wizard steps Audience → Content → Schedule → Review, immutable recipient snapshot, status transitions, recipient counts, and suppression warnings.

**Verification:**

```text
pnpm vitest run src/modules/email-marketing/campaign-state.test.ts app/\(protected\)/email-marketing/campaigns/campaign-wizard.test.tsx
pnpm typecheck
```

## Task 6: Delivery and Resend Webhooks

**Files:**

- Modify: `src/modules/notifications/service.ts`
- Modify: `src/modules/notifications/index.ts`
- Modify: `src/modules/email-marketing/db.ts`
- Modify: `src/modules/email-marketing/service.ts`
- Create: `app/api/jobs/email-campaigns/route.ts`
- Create: `app/api/webhooks/resend/route.ts`
- Test: `src/modules/email-marketing/delivery.test.ts`
- Test: `app/api/webhooks/resend/route.test.ts`

**Deliverable:** Bounded batch processing, idempotent recipient claims, message IDs, transient retry handling, permanent suppression, and provider-event deduplication.

**Verification:**

```text
pnpm vitest run src/modules/email-marketing/delivery.test.ts app/api/webhooks/resend/route.test.ts
pnpm lint
```

## Task 7: Unsubscribe and Audit

**Files:**

- Create: `src/modules/email-marketing/unsubscribe.ts`
- Create: `src/modules/email-marketing/unsubscribe.test.ts`
- Create: `app/email/unsubscribe/[token]/route.ts`
- Modify: `src/modules/audit/index.ts` only through its public interface if required
- Test: `app/email/unsubscribe/[token]/route.test.ts`

**Deliverable:** Opaque scoped unsubscribe token, idempotent unsubscribe action, campaign link insertion, and audit events for campaign lifecycle actions.

**Verification:**

```text
pnpm vitest run src/modules/email-marketing/unsubscribe.test.ts app/email/unsubscribe/\[token\]/route.test.ts
```

## Task 8: Navigation, Event Context, and Final Verification

**Files:**

- Modify: `app/(protected)/sidebar.tsx` only after rebasing against latest `dev`
- Create: `app/(protected)/events/[id]/email-marketing/page.tsx`
- Create: `app/(protected)/events/[id]/email-marketing/page.test.tsx`
- Modify: public Event integration files only after the Events agent confirms a stable checkpoint

**Deliverable:** Global Email Marketing navigation, event-context campaign view, admin guards, responsive states, and coordinated integration.

**Verification:**

```text
pnpm vitest run app/\(protected\)/events/\[id\]/email-marketing/page.test.tsx
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Integration Gate

Before merging or pushing:

```text
git fetch origin
git status --short
git diff --check
git rebase origin/dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff origin/dev...HEAD --stat
```

Review the commit range and confirm that no `.atl`, `.codex`, generated local
files, or unrelated Event Editor changes are included. Integration into `dev`
and promotion to `master` are separate operations and require explicit approval.
