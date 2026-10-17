# Live Questions UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live questions presentation-ready with persistent access details, automatic updates, a blue reversible like control, and a compact light public experience.

**Architecture:** Keep the existing server-rendered App Router data flow and participant cookie identity. Add a persisted display copy of the access code while retaining the hash for public verification, make vote state explicit in public question data, and use three-second `router.refresh()` polling on both public and protected clients instead of introducing a realtime transport.

**Tech Stack:** Next.js App Router, React Server Actions, TypeScript, Drizzle ORM/Postgres, Tailwind CSS, Vitest, `lucide-react`.

## Global Constraints

- Preserve the existing one-vote-per-participant constraint.
- Use a blue accent for the active like state.
- The public portal uses the event landing page light visual language.
- Polling runs every three seconds and cleans up on unmount.
- Do not add WebSocket or Supabase Realtime infrastructure in this iteration.
- Remove topic controls from the live moderation card only; retain topic data and backend actions.
- Keep the current code hash for public code verification; the display code is protected-panel data only.
- Preserve accessible labels, keyboard focus, responsive wrapping, and non-color state indicators.

---

### Task 1: Persist The Current Access Code

**Files:**
- Create: `drizzle/0038_live_questions_ux.sql`
- Modify: `src/modules/questions/db.ts:25-46`
- Modify: `src/modules/questions/service.ts:67-90`
- Modify: `app/(protected)/events/[id]/questions/question-session-panel.tsx:8-49`
- Test: `src/modules/questions/db.test.ts`

**Interfaces:**
- `questionSessions.displayCode: text | null` stores the current code for the protected panel.
- `QuestionSessionWithCode` continues to return `{ session, code }` after generation.
- `QuestionSessionRow.displayCode` is rendered only by the protected `QuestionSessionPanel`.

- [ ] **Step 1: Write the schema test for the display-code column.**

Add an assertion beside the existing `questionSessions` table assertions:

```ts
it("stores a display code separately from the verification hash", () => {
  const columns = getTableConfig(questionSessions).columns;
  expect(columns.some((column) => column.name === "display_code")).toBe(true);
  expect(columns.some((column) => column.name === "code_hash")).toBe(true);
});
```

- [ ] **Step 2: Run the focused schema test and verify the new assertion fails.**

Run: `pnpm vitest run src/modules/questions/db.test.ts`

Expected: FAIL because `display_code` does not yet exist.

- [ ] **Step 3: Add the nullable display column and migration.**

Add `displayCode: text("display_code")` after `codeHash` in `questionSessions`. Create `drizzle/0038_live_questions_ux.sql` with the repository's migration format and verify it adds a nullable `display_code` column to `question_sessions` without altering `code_hash`.

- [ ] **Step 4: Populate the display code on create and regeneration.**

Update both writes in `createOrRegenerateQuestionSession`:

```ts
.set({
  codeHash,
  displayCode: code,
  status: "open",
  closedAt: null,
  codeCreatedAt: new Date(),
  updatedAt: new Date(),
})
```

```ts
.values({
  eventId: input.eventId,
  organizationId: input.organizationId,
  codeHash,
  displayCode: code,
})
```

- [ ] **Step 5: Render persisted code, URL, and QR on every protected page load.**

Change `QuestionSessionPanel` to initialize the displayed code from `session?.displayCode`, while keeping the action result as the immediate post-submit override:

```tsx
const code = state.code ?? session?.displayCode;
const publicUrl = code ? `${window.location.origin}/questions/${code}` : undefined;
```

Because this component is client-side and the server action already returns the configured public origin, pass `publicUrl` as a prop from the protected page or expose a server-built `publicUrl` alongside the session. Do not derive production URLs from `window.location.origin` when `NEXT_PUBLIC_APP_ORIGIN` is configured.

- [ ] **Step 6: Run schema and type checks.**

Run: `pnpm vitest run src/modules/questions/db.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 7: Commit the persistence unit.**

```bash
git add drizzle src/modules/questions/db.ts src/modules/questions/service.ts src/modules/questions/db.test.ts "app/(protected)/events/[id]/questions/question-session-panel.tsx"
git commit -m "feat: persist live question access code"
```

### Task 2: Implement Reversible Participant Likes

**Files:**
- Modify: `src/modules/questions/service.ts:25-35,244-278`
- Modify: `app/questions/[code]/actions.ts:78-87`
- Modify: `app/questions/[code]/page.tsx:17-24`
- Modify: `src/modules/questions/index.ts` to export `toggleVoteForQuestion`
- Test: `src/modules/questions/service.test.ts`

**Interfaces:**
- `PublicQuestion` gains `hasVoted: boolean`.
- `listPublicQuestions(sessionId: string, participantId: string): Promise<PublicQuestion[]>` includes per-participant vote state.
- `toggleVoteForQuestion(input: { questionId: string; participantId: string }): Promise<{ voted: boolean }>` inserts or deletes exactly one participant vote.

- [ ] **Step 1: Add failing service tests for add, remove, duplicate protection, and participant isolation.**

Use the repository's existing database-test setup and assert this behavior:

```ts
it("toggles a participant vote and cannot affect another participant", async () => {
  const first = await toggleVoteForQuestion({ questionId, participantId: firstParticipantId });
  expect(first.voted).toBe(true);

  const second = await toggleVoteForQuestion({ questionId, participantId: firstParticipantId });
  expect(second.voted).toBe(false);

  await toggleVoteForQuestion({ questionId, participantId: secondParticipantId });
  const questions = await listPublicQuestions(sessionId, firstParticipantId);
  expect(questions[0]?.voteCount).toBe(1);
  expect(questions[0]?.hasVoted).toBe(false);
});
```

Also assert that a participant from another session receives the existing `Participant cannot vote for this question` error.

- [ ] **Step 2: Run the focused service tests and verify they fail.**

Run: `pnpm vitest run src/modules/questions/service.test.ts`

Expected: FAIL because `toggleVoteForQuestion`, `hasVoted`, and the participant-aware query do not exist.

- [ ] **Step 3: Implement the atomic toggle.**

Keep the existing question/session/participant validation, then look up the composite key and delete or insert:

```ts
const existing = await db
  .select({ questionId: questionVotes.questionId })
  .from(questionVotes)
  .where(and(
    eq(questionVotes.questionId, input.questionId),
    eq(questionVotes.participantId, input.participantId),
  ))
  .limit(1);

if (existing.length > 0) {
  await db.delete(questionVotes).where(and(
    eq(questionVotes.questionId, input.questionId),
    eq(questionVotes.participantId, input.participantId),
  ));
  return { voted: false };
}

await db.insert(questionVotes).values(input).onConflictDoNothing();
return { voted: true };
```

- [ ] **Step 4: Make public question listing participant-aware.**

Add a left join scoped to the current participant, or a second query keyed by returned question IDs, and map:

```ts
hasVoted: Boolean(participantVote),
```

Do not change the aggregate `voteCount` join; it must continue counting all participants.

- [ ] **Step 5: Update the server action to return the toggle result.**

Replace `voteForQuestion` with `toggleVoteForQuestion` and return `{ success: "Voto actualizado.", voted: result.voted }` from the action state type.

- [ ] **Step 6: Pass the participant ID from the public page.**

Change the existing page call from:

```ts
const questions = await listPublicQuestions(session.id);
```

to:

```ts
const questions = await listPublicQuestions(session.id, participant.id);
```

- [ ] **Step 7: Run focused tests and typecheck.**

Run: `pnpm vitest run src/modules/questions/service.test.ts src/modules/questions/db.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 8: Commit the vote unit.**

```bash
git add src/modules/questions app/questions/[code]
git commit -m "feat: add reversible question likes"
```

### Task 3: Build The Public Light Portal Interaction

**Files:**
- Modify: `app/questions/[code]/public-question-list.tsx:1-77`
- Modify: `app/questions/[code]/page.tsx` only if the public origin or participant data needs adjustment
- Test: `app/questions/[code]/public-question-list.test.tsx`

**Interfaces:**
- `PublicQuestionList` receives `PublicQuestion[]` with `hasVoted`.
- The like control submits `code` and `questionId` to the existing server action.
- `router.refresh()` runs every 3000ms and is cleared on unmount.

- [ ] **Step 1: Add the polling cleanup test using the project's existing React test conventions.**

Assert that mounting schedules a 3000ms interval, refreshes the router, and unmounting clears it. Use the existing Vitest/React test setup; do not add a new test framework.

- [ ] **Step 2: Replace the 15000ms interval with the approved 3000ms interval.**

Use:

```tsx
useEffect(() => {
  const interval = window.setInterval(() => router.refresh(), 3000);
  return () => window.clearInterval(interval);
}, [router]);
```

- [ ] **Step 3: Add optimistic like state per question.**

Create `app/questions/[code]/question-like-button.tsx` with state initialized from `question.hasVoted` and `question.voteCount`. On click, update the local state before submitting; roll back when the action returns an error. Keep the server-rendered list as the source of truth after polling.

- [ ] **Step 4: Render the blue thumb control without visible text.**

Use the repository's installed icon library and a real button:

```tsx
<button
  type="submit"
  aria-label={voted ? "Quitar voto" : "Votar pregunta"}
  title={voted ? "Quitar voto" : "Votar pregunta"}
  className={voted ? "text-sky-500" : "text-muted-foreground"}
>
  <ThumbsUp aria-hidden="true" className={voted ? "fill-current" : ""} />
  <span aria-live="polite">{voteCount}</span>
</button>
```

Add a short `active:scale-90`/keyframe animation that respects `prefers-reduced-motion`.

- [ ] **Step 5: Apply the landing light visual language to the public page.**

Replace dark theme-token classes with explicit public-surface classes matching the existing landing: warm cream page background, white cards, dark ink text, soft borders, and blue primary action. Keep the participant registration flow visually consistent with the same surface.

- [ ] **Step 6: Update public copy and error behavior.**

Keep pending questions out of the public list, but change the submission success copy to explain that moderation is required. Keep vote failures inline and non-blocking.

- [ ] **Step 7: Run focused checks.**

Run: `pnpm typecheck`

Expected: exit code 0.

Run: `pnpm lint`

Expected: exit code 0.

- [ ] **Step 8: Commit the public UI unit.**

```bash
git add app/questions
git commit -m "feat: refresh live question portal"
```

### Task 4: Refresh And Simplify The Protected Panel

**Files:**
- Modify: `app/(protected)/events/[id]/questions/page.tsx:19-70`
- Modify: `app/(protected)/events/[id]/questions/question-list.tsx:1-75`
- Modify: `app/(protected)/events/[id]/questions/question-session-panel.tsx:8-49`
- Modify: `app/(protected)/events/[id]/questions/actions.ts` only if a refresh/revalidation path is missing
- Test: `app/(protected)/events/[id]/questions/question-session-panel.test.tsx` and `app/(protected)/events/[id]/questions/question-list.test.tsx`

**Interfaces:**
- `QuestionList` keeps its current `eventId`, `sessionId`, `questions`, and `topics` props, but no longer renders topic assignment controls.
- `QuestionSessionPanel` receives the persisted session and renders its `displayCode` without requiring a new action result.
- The protected page refreshes every 3000ms while mounted.

- [ ] **Step 1: Add the protected-page polling effect.**

Create `app/(protected)/events/[id]/questions/question-live-refresh.tsx` as a client boundary that calls `router.refresh()` every 3000ms and clears the interval on unmount. Render the existing server-rendered page content inside it and keep search/filter query parameters intact.

- [ ] **Step 2: Remove topic assignment controls from each live question card.**

Delete the `assignQuestionTopicAction` import and the `<form>` containing `Asignar tema`/`Asignar`. Leave `question.topics` display and the separate `Nuevo tema` form untouched unless the product owner explicitly requests topic creation removal.

- [ ] **Step 3: Keep actions in one compact row with safe responsive behavior.**

Use a wrapping flex row for moderation actions and the answer form. Do not force a desktop-width row on mobile; use `min-w-0`, `flex-1`, and `sm:flex-row` where needed to prevent horizontal overflow.

- [ ] **Step 4: Render current code, URL, and QR from persisted session data.**

Pass a server-computed `publicUrl` into `QuestionSessionPanel` using `env.NEXT_PUBLIC_APP_ORIGIN` and `session.displayCode`. Render the QR with the persisted code. Keep the action result as an immediate optimistic display after generation/regeneration.

- [ ] **Step 5: Make regeneration secondary.**

Use an outline/secondary visual treatment for `Regenerar código`; keep `Generar código` as the primary action only when no session exists. Do not invoke regeneration during page render or polling.

- [ ] **Step 6: Run checks.**

Run: `pnpm typecheck`

Expected: exit code 0.

Run: `pnpm lint`

Expected: exit code 0.

- [ ] **Step 7: Commit the protected-panel unit.**

```bash
git add "app/(protected)/events/[id]/questions"
git commit -m "feat: streamline live question moderation"
```

### Task 5: End-To-End Presentation Verification

**Files:**
- Modify only files required by failing verification; do not add unrelated refactors.
- Test: existing question tests plus browser verification against the local dev server.

- [ ] **Step 1: Run all focused question tests.**

Run: `pnpm vitest run src/modules/questions app/questions/[code] "app/(protected)/events/[id]/questions"

Expected: all question module tests pass, including vote toggle and schema migration coverage.

- [ ] **Step 2: Run project quality checks.**

Run: `pnpm typecheck`

Expected: exit code 0.

Run: `pnpm lint`

Expected: exit code 0.

Run: `pnpm build`

Expected: exit code 0.

- [ ] **Step 3: Verify the live flow in two browser tabs.**

Use one public tab and one protected moderation tab:

1. Generate a code once; navigate away and back; confirm the same code, URL, and QR remain visible.
2. Submit a new participant question; confirm it appears in the protected pending list within one polling interval.
3. Approve it; confirm it appears publicly within one polling interval.
4. Click the blue thumb; confirm the count increments and the icon fills without a page reload.
5. Click it again; confirm the count decrements and the icon returns to outline.
6. Confirm a second participant can vote independently.
7. Confirm no horizontal overflow on a narrow viewport.

- [ ] **Step 4: Commit only verification fixes.**

```bash
git status --short
```

Do not commit generated `.codegraph` files or ignored local `.env` changes.

## Self-Review

- Spec coverage: persistent code is covered by Task 1; reversible likes and `hasVoted` by Task 2; public light UI and animation by Task 3; polling, one-row actions, topic-control removal, and panel persistence by Task 4; end-to-end evidence by Task 5.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step is required; the migration path and public interfaces are explicit.
- Type consistency: `PublicQuestion.hasVoted`, `listPublicQuestions(sessionId, participantId)`, and `toggleVoteForQuestion(...)` are defined before their consumers.
- Security: `codeHash` remains the public verification source; `displayCode` is rendered only in the authenticated protected panel.
- Scope: no realtime transport, unrelated admin redesign, or topic backend deletion is included.
