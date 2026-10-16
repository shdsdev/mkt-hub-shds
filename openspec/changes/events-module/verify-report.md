```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:8148dd799c204a6adbdde5ca2f9d4ef6239cba8da549e27f1071c95aeb7440b6
verdict: fail
blockers: 1
critical_findings: 1
requirements: 3/10
scenarios: 6/16
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:8f35cdb1c41870f23b0a4cfaa87d808ec32a5b4e8c9a07c7053b0241c110b8bd
build_command: pnpm exec tsc --noEmit -p tsconfig.json
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report — PR2 Re-verify

**Change**: events-module (scope: PR2 only)
**Commit**: `b17b303` on `feature/events-module-pr2-admin-notifications` (parent `95693e2`, grandparent `829e449` = PR1)
**Mode**: Strict TDD
**Supersedes**: the `95693e2` FAIL report (3 CRITICAL / 11 WARNING)

### Verdict: FAIL — 1 CRITICAL (new), 4 WARNING, 2 SUGGESTION

**All 5 originally-reported findings (C1, C2, C3, W2, W4) are genuinely closed and independently
mutation-proven.** The FAIL verdict rests on a single NEW blocker (N1) that is a migration-delivery
gap inherited from PR1, not a regression introduced by `b17b303`.

### Original findings — re-check results

| ID | Finding | Result | Proof |
|---|---|---|---|
| C1 | `claimNotification` ON CONFLICT idempotency unpinned | **CLOSED** | Deleting the `onConflictDoNothing` call now fails 2 tests (was: 19 passed) |
| C2 | "Fixed Optional Field Catalog" unimplemented | **CLOSED (code)** | Migration + columns + service + both forms; insert pass-through pinned. Planning artifacts still unsynced (N3) |
| C3 | Draft-exclusion published-status filter unpinned | **CLOSED** | Dropping the predicate now fails 1 test (was: 38 passed) |
| W2 | `updateEventAction` could never clear description/location | **CLOSED** | Reverting the null mapping now fails 1 test; both branches covered |
| W4 | `getPublishedEventBySlug` lacked org scoping | **CLOSED** | Param added + applied; dropping the clause now fails 1 test |

### Mutation probe evidence (the decisive technique, re-applied)

Every probe mutated committed source, re-ran the focused suite, then restored and proved
byte-identity with `git diff --exit-code` (exit 0 each time).

| Mutation | Before (95693e2) | After (b17b303) | Pinned? |
|---|---|---|---|
| Delete the `onConflictDoNothing` target call | 19 passed | **2 failed** / 17 passed | YES |
| Point conflict target at wrong columns | n/a | **2 failed** / 17 passed | YES |
| Drop the published-status predicate | 38 passed | **1 failed** / 40 passed | YES |
| Drop the organizationId predicate | n/a | **1 failed** / 40 passed | YES |
| Remove toggles from the createEvent insert | n/a | **1 failed** / 40 passed | YES |
| Revert the W2 null mapping | n/a | **1 failed** / 10 passed | YES |
| Revert slug to raw formData.get | n/a | **2 failed** / 9 passed | YES |

The wrong-columns probe matters: the C1 test pins the *exact* conflict target, not merely that the
call exists. The remediation is substantive, not assertion theatre.

### C2 detail — migration vs. schema, element-for-element

`drizzle/0028_events_optional_fields.sql` adds:

- `ALTER TABLE "events" ADD COLUMN "collect_company" boolean DEFAULT false NOT NULL;`
- `ALTER TABLE "events" ADD COLUMN "collect_job_title" boolean DEFAULT false NOT NULL;`

`src/modules/events/db.ts` declares:

- `collectCompany: boolean("collect_company").notNull().default(false)`
- `collectJobTitle: boolean("collect_job_title").notNull().default(false)`

Exact match on name, type, nullability, and default. `boolean` was already imported from
`drizzle-orm/pg-core` (no missing-import defect). `src/db/schema.ts` barrel-exports
`@/modules/events/db`, so drizzle-kit sees the table.

**Persistence is real, not type-only**: `createEvent` passes both fields into the insert values
(probe-pinned); `updateEvent` passes `input.changes` wholesale to `.set()`, so no field can be
silently dropped.

**Both admin forms genuinely render and submit the toggles** (read from the real JSX, not the tests):
`event-create-form.tsx` and `[id]/edit/event-edit-form.tsx` each render a `Checkbox` plus a hidden
input whose value is `collectCompany ? "true" : ""`. That pattern is correct for
`z.coerce.boolean()` — note that a `"false"` string would have coerced to **true**; the implementer
avoided that trap. The edit form seeds its state from `event.collectCompany`.

**Spec satisfaction**: the requirement's "MUST NOT allow defining new, arbitrary, or free-form fields"
clause is satisfied by fixed columns with no field builder. Both scenarios' THEN-clauses assert on the
*public registration form*, which is PR3 — so the ADMIN-authoring half is complete and the rendering
half is a legitimate PR3 deferral, no longer a silently-dropped requirement.

### W2 detail — null-vs-undefined correctness under Zod partial semantics

`updateEventFieldsSchema = eventFieldsSchema.partial({ name: true, slug: true, startsAt: true })`.
`description` is `z.string().trim().max(5000).optional().or(z.literal(""))`.

- Field submitted empty: parses to the empty string, then the ternary yields **null**, so Drizzle
  `.set()` actually clears the stored value. Correct.
- Field key absent: null-coalesced to **undefined**, accepted by `.optional()`, left undefined, so
  Drizzle skips the key. Correct.

The logic is right for partial-schema semantics, and both branches have dedicated passing tests.

**The claimed additional bug is REAL.** At `95693e2`, `readEventFields` returned `formData.get("slug")`
raw, which is `null` when the key is absent. Zod `.optional()` accepts undefined but **rejects
null**. I confirmed by reading `event-edit-form.tsx` at `95693e2` that it renders `name` and
`startsAt` but **no slug input** — so every real admin edit submission parsed to failure and
returned the invalid-form error. Reverting the null-coalesce reproduces 2 test failures. This was a
genuine, user-visible, previously-unreported bug that the remediation fixed.

### Import resolution against the COMMIT TREE (PR1-lesson discipline)

Every import specifier in all 9 changed source files was extracted from `git show b17b303:<path>` and
resolved with `git cat-file -e` against the commit tree — never the working directory.
`tsconfig.json` maps `@/*` to `./src/*`.

| Specifier | Resolved in `b17b303` |
|---|---|
| `@/components/checkbox` | `src/components/checkbox.tsx` OK |
| `@/components/ui/button`, `@/components/ui/input` | OK |
| `@/db/client`, `@/lib/env` | OK |
| `@/modules/auth`, `@/modules/events`, `@/modules/users` | `index.ts` OK |
| `@/modules/users/db` | OK |
| `./db` (events, notifications) | OK |
| `./service`, `./actions`, `../../actions` | OK |

`Checkbox` really exports `checked: boolean`, `onChange: (checked: boolean) => void`, and
`label: string` — matching both call sites exactly. `notificationLog` really exports `subjectId` and
`notificationType`, and its `unique("notification_log_subject_type_unique")` constraint on those two
columns matches the conflict target the C1 test pins. **No PR1-style phantom-import defect.**

### Toolchain evidence (run independently by verify)

| Command | Exit | Result |
|---|---|---|
| `pnpm test` | 0 | **58 files, 303 tests, 303 passed** |
| `pnpm exec tsc --noEmit -p tsconfig.json` | 0 | zero output |
| `pnpm exec eslint .` | 0 | zero errors, zero warnings |

The implementer's 303/303 claim is **true**. Net +6 tests over the 297 baseline.

### Git hygiene — PASS

`git show b17b303 --stat` touches exactly the **10** claimed files, 270 insertions / 24 deletions.
A path scan for `src/modules/agents/`, `app/(protected)/agents/`, `app/(protected)/copilot/`,
`app/api/agents/`, `scripts/knowledge-worker*`, `openspec/changes/archive/2026-10-01-*`, and
`openspec/changes/marketing-hub-tools-calling` returned **zero matches**. No scope leak.

### Spec compliance matrix (PR2 scope: event-management + notifications-email)

| Requirement | Status | Note |
|---|---|---|
| ADMIN-Only Event Authoring | PASS | 2/2 scenarios, guards mutation-pinned |
| Event Lifecycle Status | PASS | 2/2; draft-exclusion now pinned (C3) |
| Nullable Capacity | PARTIAL | Column accepted; registrations-past-any-count is PR3 |
| Per-Event Reminder Timing | PARTIAL | Offset persists; dispatch is PR5 |
| Fixed Optional Field Catalog | PARTIAL | Admin/persistence half complete; public form is PR3 |
| Confirmation Email Content | PARTIAL | Stub HTML per PR2 scope; escaping pinned |
| Waitlist Promotion Email | PARTIAL | Stub; send sequence tested |
| Configurable Reminder Email | PARTIAL | Stub |
| Webhook-Driven Reminder Trigger | NOT STARTED | PR5 |
| Notification Log for Idempotency | PASS | 2/2; DB-level concurrency residual (see N5) |

**Requirements fully satisfied: 3/10** (was 1/10). **Scenarios fully satisfied: 6/16** (was 3/16).
The increase is entirely attributable to C1 and C3 closure.

### CRITICAL (new)

- **N1 — Migration `0028` is never applied: it is absent from `drizzle/meta/_journal.json`.**
  `pnpm db:migrate` is plain `drizzle-kit migrate`, which executes only journal-registered
  migrations; there is no custom runner in the repo. The journal has 17 entries ending at
  `0016_utm_taxonomy_creator` — neither `0027_events_module` (PR1) nor `0028_events_optional_fields`
  is registered. Consequently `collect_company` and `collect_job_title` will not exist in any real
  database, and because `db.ts` declares them NOT NULL, every `select()` against `events` would
  fail with a missing-column error. C2's code half is genuinely closed, but its *delivery* half is
  not. **This is inherited, documented, and maintainer-assigned** — the implementer flagged the
  journal/snapshot drift in both PR1 and PR2 apply-progress and repeated it in the `0028` file
  header. It is not a regression from `b17b303`, but it is now load-bearing for C2 and it blocks any
  runtime or staging validation of this feature.

### WARNING

- **N2 — `apply-progress` was never updated for `b17b303`.** The Engram artifact (#3083, 15:17) still
  describes only `95693e2` and predates the report it supposedly answers. Verify had to reconstruct
  the remediation claims from the commit message. The pipeline contract expects apply to persist its
  own progress, including a TDD Cycle Evidence table for the remediation work unit.
- **N3 — C2's "untracked" half persists.** `tasks.md` and `design.md` still contain **zero**
  references to an optional-field catalog, toggle, company, or job-title work unit. The code now
  exists but no task records it, so the 15 checked tasks do not account for this work.
- **N4 (carried, was W7) — `openspec/changes/events-module/` is still untracked** and absent from the
  commit; reviewers cannot see spec/design/tasks from the PR.
- **N5 (carried residual of C1) — DB-level concurrency remains unproven.** The test pins that the
  correct ON CONFLICT target is *requested*; no Postgres harness exists to prove two racing inserts
  resolve to one row. The implementer documented this honestly in a code comment. PR4's webhook
  safe-to-retry guarantee still rests on an untested engine-level property.
- **Carried, unaddressed from the prior report**: W1 (no page-level test, so the route `notFound()`
  ADMIN guard stays unpinned), W3 (backupCode/intro escaping unpinned), W5 (zero integration tests),
  W8 (`.env.example` still missing 4 keys), W10 (1401+ insertions vs the 400-line budget).

### SUGGESTION

- **N6 — `updateEventAction` always sends the two toggles as booleans**, never undefined, because
  `z.coerce.boolean()` turns an absent key's null into false. Any future partial-form submission that
  omits the checkboxes would silently reset both toggles to false. Harmless today (both forms render
  them), fragile later.
- **N7 — the `updateEvent` toggle test asserts only the mocked return row**, not the `.set()` payload.
  It is safe only because `.set(input.changes)` is pass-through; a future field-by-field refactor
  would not be caught.

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | FAIL | No evidence table for `b17b303` — apply-progress not updated (N2) |
| All changed behaviors have tests | PASS | 6/6 remediations have mutation-proven covering tests |
| GREEN confirmed (tests pass) | PASS | 303/303 on independent execution |
| Triangulation adequate | PASS | W2 covers both branches; C1 covers present/absent/wrong-target |
| Assertion quality | PASS | No tautologies, ghost loops, or smoke-only tests in the new assertions |

The commit message states the probes were re-run and restored; `git diff --exit-code` on the PR2
paths confirms the tree is byte-identical to `b17b303` after my own probes.

### Go / No-Go for PR3

**GO for PR3 code work, conditioned on N1.**

The three blockers that made PR3 unsafe are gone: `getPublishedEventBySlug` is now draft-filtered
*and* org-scoped with both clauses test-pinned (C3/W4), and the optional-field columns PR3's
registration form must read now exist in schema and are persisted end-to-end (C2). PR3 can be written
against a correct contract.

N1 must be resolved before any `pnpm db:migrate`, staging deploy, or runtime validation — the columns
do not exist in a real database today. This is a maintainer task on the pre-existing journal drift
(0017 through 0028), not PR2 rework, and it does not block authoring PR3.
