# Campaign Audience UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make campaign audience selection explain exactly who will receive a campaign, who is excluded, and why before the user continues.

**Architecture:** Enrich the server-provided segment summary with matched, eligible, and excluded counts, then render one selected-audience summary in the wizard and repeat the same snapshot in the delivery/review step. Keep the existing premium `Select`, campaign state, organization scoping, and audience snapshot behavior; remove event-specific sender defaults from this flow.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Drizzle-backed Email Marketing services.

## Global Constraints

- Keep all Email Marketing queries organization-scoped.
- Preserve the existing premium dropdown component and keyboard/focus behavior.
- Do not modify event email templates or event-specific email branding.
- Exclude unsubscribed, suppressed, and consent-ineligible contacts from sendable counts.
- Use the existing `segments` and `eligibleContactCount` data as the source of truth; do not invent client-side counts.
- Keep mobile layouts single-column with no horizontal overflow.

---

### Task 1: Enrich Audience Summary Data

**Files:**
- Modify: `app/(protected)/email-marketing/campaigns/new/page.tsx`
- Modify: `app/(protected)/email-marketing/campaigns/[id]/edit/page.tsx`
- Modify: `app/(protected)/email-marketing/campaigns/new/email-marketing-wizard.tsx`

**Interfaces:**
- `segments` entries produce `{ id, name, definition, matchedContactCount, eligibleContactCount, excludedContactCount }`.
- `eligibleContactCount` remains the count of contacts that can receive the campaign.
- `excludedContactCount` is `matchedContactCount - eligibleContactCount`, never below zero.

- [x] **Step 1: Add failing data-shape assertions**

Add a focused test or pure helper assertion near the existing Email Marketing tests that verifies a segment summary preserves:

```ts
expect(buildAudienceSummary({ matchedContactCount: 10, eligibleContactCount: 7 })).toEqual({
  matchedContactCount: 10,
  eligibleContactCount: 7,
  excludedContactCount: 3,
});
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run:

```text
pnpm vitest run src/modules/email-marketing/audience.test.ts
```

Expected: FAIL because the summary helper or equivalent data shape is not implemented.

- [x] **Step 3: Implement server-side segment summaries**

In both campaign page loaders, retain the full segment matches before filtering subscribed contacts:

```ts
const matches = await listEmailSegmentMatches({
  organizationId: user.profile.organizationId,
  definition: segment.definition,
});
const eligibleContactCount = matches.filter((contact) => contact.subscriptionStatus === "subscribed").length;

return {
  id: segment.id,
  name: segment.name,
  definition: segment.definition,
  matchedContactCount: matches.length,
  eligibleContactCount,
  excludedContactCount: Math.max(0, matches.length - eligibleContactCount),
};
```

Use the same shape for new and edit campaign routes so the wizard does not need route-specific logic.

- [x] **Step 4: Run focused tests and typecheck**

Run:

```text
pnpm vitest run src/modules/email-marketing/audience.test.ts
pnpm typecheck
```

Expected: PASS.

### Task 2: Redesign the Audience Step

**Files:**
- Modify: `app/(protected)/email-marketing/campaigns/new/email-marketing-wizard.tsx`

**Interfaces:**
- The wizard consumes the enriched segment summary shape from Task 1.
- The selected segment renders one audience snapshot directly below the selector.

- [x] **Step 1: Add the selected-audience summary state contract**

Extend the wizard segment type with `matchedContactCount` and `excludedContactCount`, then derive:

```ts
const selectedAudience = audienceMode === "segment" ? selectedSegment : undefined;
const selectedAudienceCount = selectedAudience?.eligibleContactCount ?? eligibleContactCount;
```

- [x] **Step 2: Replace the ambiguous segment card copy**

Keep the two audience mode cards, but make the selected segment card describe the choice rather than only showing the number of saved segments. After selecting a segment, render a dedicated summary card with:

```text
Audiencia seleccionada
Shades de México
1,959 contactos recibirán este correo
2,004 contactos coinciden · 45 quedan excluidos
Bajas, supresiones y contactos sin consentimiento quedan fuera automáticamente.
```

Render filter chips from the existing definition for `tags`, `eventIds`, `subscriptionStatuses`, and condition count. Use neutral labels such as `3 etiquetas`, `2 eventos`, and `Estado: suscripto`; do not expose raw UUIDs as visible copy.

- [x] **Step 3: Handle empty segments explicitly**

When `selectedAudienceCount === 0`, render an inline warning explaining that the campaign cannot continue until the audience has eligible contacts. Disable `Continuar` while the selected audience is empty.

- [x] **Step 4: Make the footer the single source of truth**

Replace the generic footer sentence with:

```text
Se enviará a {selectedAudienceCount} contactos
```

Keep the audience snapshot note nearby: `La audiencia se congelará al guardar la campaña.`

- [x] **Step 5: Remove event-specific sender defaults**

Change the wizard fallback `fromName` from `Shades + Spaces` to the institutional `Shades de México` value. Keep existing campaign values unchanged when editing an existing campaign.

- [x] **Step 6: Run focused verification**

Run:

```text
pnpm typecheck
pnpm lint
pnpm vitest run src/modules/email-marketing
```

Expected: PASS with no native select or accessibility regressions.

### Task 3: Repeat the Snapshot in Delivery Review

**Files:**
- Modify: `app/(protected)/email-marketing/campaigns/new/email-marketing-wizard.tsx`

- [x] **Step 1: Add the review summary block**

In the schedule/review branch, render the same audience summary values used by the audience step:

```text
Audiencia
Shades de México
1,959 destinatarios elegibles
45 excluidos automáticamente
```

Do not create a second count calculation in the review branch.

- [x] **Step 2: Add send safety copy**

When sending now or scheduling, show that the final recipient snapshot is created at save/send time and that unsubscribed or suppressed contacts are checked again before delivery.

- [x] **Step 3: Verify responsive behavior**

Confirm the summary is one column below `md`, the metric row wraps cleanly, and the primary action remains reachable without horizontal scrolling.

### Task 4: Verification and Commit

**Files:**
- Test: `src/modules/email-marketing/audience.test.ts`
- Modify: audience wizard/page files from Tasks 1–3

- [x] **Step 1: Run the full relevant test suite**

Run:

```text
pnpm vitest run src/modules/email-marketing
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all relevant tests pass, typecheck/lint pass, and production build completes.

- [ ] **Step 2: Review the visual states**

Check these states in the browser at desktop and mobile widths:

- All subscribers selected.
- A segment selected with eligible contacts.
- A segment selected with zero eligible contacts.
- A segment with exclusions.
- Review step after changing the segment.

- [ ] **Step 3: Commit the work unit**

```bash
git add app/(protected)/email-marketing/campaigns/new/page.tsx app/(protected)/email-marketing/campaigns/[id]/edit/page.tsx app/(protected)/email-marketing/campaigns/new/email-marketing-wizard.tsx src/modules/email-marketing/audience.test.ts
git commit -m "feat(email-marketing): clarify campaign audience selection"
```
