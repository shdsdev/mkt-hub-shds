# Raffle Live Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a token-protected public stage screen for live raffle reveals, reorganize the admin raffle layout into full-width three-column prize cards with the audit log below, and email the winner when the admin confirms delivery.

**Architecture:** Store only a SHA-256 hash of a random stage token on the raffle. The public route validates the raw token and exposes event/prize/draw state through a token-authorized stage page. The stage API can request the next prize draw, while admin-only Server Actions perform confirmation and email delivery; the stage client polls the public endpoint and animates the selected winner.

**Tech Stack:** Next.js App Router, React client components, Drizzle/Postgres, Server Actions, Vitest, Tailwind, Resend notification service.

## Global Constraints

- Keep all visible UI copy in Spanish.
- Do not expose attendee email, filters, or admin audit data on the public stage screen; the attendee code is shown because it is the requested auditorium reveal and the URL is protected by a secret token.
- Generate tokens with cryptographically secure random bytes and persist only their hash.
- Preserve the existing 24-hour `HH:mm` deadline value submitted by the form.
- Do not modify `.atl/*` or `.codex/` local artifacts.
- Do not commit or push unless explicitly requested.

---

### Task 1: Add stage-token and winner-company data model

**Files:**
- Modify: `src/modules/raffles/db.ts`
- Modify: `src/modules/events/db.ts` or use the existing attendee company field source
- Create: `drizzle/0047_raffle_live_stage.sql`
- Test: `src/modules/raffles/service.test.ts`

**Interfaces:**
- Add nullable `stageTokenHash` to `raffles`.
- Add `attendeeCompany` to `raffleDraws`.
- Add `createRaffleStageToken`, `getRaffleByStageToken`, and `rotateRaffleStageToken` in the raffle service.
- Return sanitized public state containing event name, current prize, draw id, status, winner name, company, and reveal timestamp.

- [ ] Write failing tests for token hashing/lookup, token rotation, and preserving the selected attendee company in a draw.
- [ ] Run `npm test -- --run src/modules/raffles/service.test.ts` and verify the new cases fail for missing symbols/fields.
- [ ] Add the migration and Drizzle schema fields with organization/event scoping.
- [ ] Implement token generation with `randomBytes(32).toString("base64url")` and SHA-256 lookup.
- [ ] Extend `drawPrizeUnit` to select and persist the attendee company.
- [ ] Run the focused service tests and verify they pass.

### Task 2: Add authenticated stage URL management

**Files:**
- Modify: `app/(protected)/events/[id]/raffle/actions.ts`
- Modify: `app/(protected)/events/[id]/raffle/raffle-management.tsx`
- Modify: `app/(protected)/events/[id]/raffle/page.tsx`
- Create: `app/events/[id]/raffle/[token]/page.tsx`
- Create: `app/events/[id]/raffle/[token]/stage-screen.tsx`
- Test: `app/(protected)/events/[id]/raffle/actions.test.ts`
- Test: `app/events/[id]/raffle/[token]/page.test.tsx`

**Interfaces:**
- Add admin action `createOrRotateStageTokenAction` returning the one-time raw URL.
- Public page accepts `{ id, token }`, hashes token, and renders only sanitized stage data.
- Stage screen polls a read-only endpoint/action at a bounded interval and animates each newly revealed draw.

- [ ] Write failing tests for unauthorized token creation, raw URL generation, invalid token 404, and public payload redaction.
- [ ] Run focused tests and verify failure.
- [ ] Implement the protected action and a copyable stage URL control in the admin header.
- [ ] Implement the public page and responsive fullscreen stage view with prize title, digit animation, winner name, company, and waiting/finished states.
- [ ] Ensure no public action can draw, reveal, invalidate, claim, or email.
- [ ] Run focused tests and verify pass.

### Task 3: Implement live draw and confirmation lifecycle

**Files:**
- Modify: `src/modules/raffles/service.ts`
- Modify: `app/(protected)/events/[id]/raffle/actions.ts`
- Modify: `app/(protected)/events/[id]/raffle/raffle-management.tsx`
- Test: `src/modules/raffles/service.test.ts`
- Test: `app/(protected)/events/[id]/raffle/actions.test.ts`

**Interfaces:**
- `drawPrizeAction` remains admin-only and creates a `pending_reveal` draw.
- Add `confirmWinnerAction` or make the existing claim action explicitly confirm delivery, send the winner email once, and return a Spanish status.
- Email delivery is idempotent through the existing `notificationLog` subject/draw uniqueness.

- [ ] Write failing tests for pending draw state, confirmation transition, company data, email payload, and failed-email retry behavior.
- [ ] Run focused tests and verify failure.
- [ ] Implement the transition so the stage animation completes before the admin confirms delivery.
- [ ] Add the event/prize instructions and claim deadline to the winner email payload/template.
- [ ] Keep invalidation available before confirmation and ensure it releases the prize unit.
- [ ] Run service/action/notification tests and verify pass.

### Task 4: Recompose the admin raffle layout

**Files:**
- Modify: `app/(protected)/events/[id]/raffle/raffle-management.tsx`
- Test: `app/(protected)/events/[id]/raffle/raffle-management.test.tsx` if the project test setup supports the component; otherwise cover pure layout helpers and run browser verification.

- [ ] Write a failing structural test or DOM assertion for full-width configuration, full-width prize cards, three internal columns at desktop, and audit log after prizes.
- [ ] Move the audit log below the prize list.
- [ ] Make the configuration form and each prize card span the content width.
- [ ] Use responsive `grid-cols-1 lg:grid-cols-3`; keep the three columns stacked on mobile.
- [ ] Give history enough width for winner identity, status, confirmation, and invalidation controls without cramped wrapping.
- [ ] Run typecheck, lint, focused tests, and the Impeccable detector.

### Task 5: End-to-end verification

**Files:**
- No new files.

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `git diff --check`.
- [ ] Run `impeccable.cmd detect --json` against changed UI files.
- [ ] Use `agent-browser` to verify the admin layout, token URL, stage waiting state, draw animation, winner reveal, and confirmation state on desktop and mobile.
- [ ] Inspect `git status` and confirm only intended files are changed; leave commit/push to the user.
