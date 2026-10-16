# Event Landing Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible public landing URL, a new-tab review button, and a copy-link action to the event edit screen.

**Architecture:** Add a pure URL helper beside the existing embed helper. The server edit page generates the landing URL and passes it to a focused client `LandingLink` component rendered below the event header and above the event navigation. No database or event action changes are required.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, pnpm.

## Global Constraints

- The public URL is `/events/<encoded-slug>`.
- Use the configured `NEXT_PUBLIC_APP_ORIGIN` and remove a trailing slash before joining paths.
- Open the landing page in a new tab with `rel="noreferrer"`.
- Keep the landing link separate from the existing embeddable-form settings.
- Do not change event slugs, routing, database schema, or analytics behavior.

---

## File Map

- Modify: `src/modules/events/embed.ts` — add the reusable public landing URL helper.
- Modify: `src/modules/events/index.ts` — export the helper through the events module boundary.
- Modify: `app/(protected)/events/[id]/edit/page.tsx` — generate and pass the landing URL.
- Create: `app/(protected)/events/[id]/edit/landing-link.tsx` — render the URL and actions.
- Modify: `src/modules/events/embed.test.ts` — test URL construction and encoding.
- Modify: `app/(protected)/events/[id]/edit/page.test.tsx` — test the server-to-client URL wiring.

## Interfaces

```typescript
export function getEventLandingUrl(origin: string, slug: string): string;
```

`LandingLink` receives:

```typescript
landingUrl: string;
```

### Task 1: Add the Landing URL Contract

**Files:**
- Modify: `src/modules/events/embed.ts`
- Modify: `src/modules/events/index.ts`
- Modify: `src/modules/events/embed.test.ts`

**Interfaces:**
- Consumes: application origin and event slug from `EditEventPage`.
- Produces: `getEventLandingUrl(origin, slug)` for the page and tests.

- [ ] **Step 1: Write the failing URL tests.**

```typescript
it("builds the public landing URL without a duplicate slash", () => {
  expect(getEventLandingUrl("https://hub.example.com/", "workshop-mayo")).toBe(
    "https://hub.example.com/events/workshop-mayo",
  );
});

it("encodes the event slug before placing it in the URL", () => {
  expect(getEventLandingUrl("https://hub.example.com", "workshop mayo")).toBe(
    "https://hub.example.com/events/workshop%20mayo",
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm vitest run src/modules/events/embed.test.ts`

Expected: FAIL because `getEventLandingUrl` is not exported.

- [ ] **Step 3: Implement and export the helper.**

```typescript
export function getEventLandingUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/events/${encodeURIComponent(slug)}`;
}
```

Export it from `src/modules/events/index.ts` beside `getEventEmbedUrl`.

- [ ] **Step 4: Run the focused test.**

Run: `pnpm vitest run src/modules/events/embed.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the URL contract.**

```bash
git add src/modules/events/embed.ts src/modules/events/index.ts src/modules/events/embed.test.ts
git commit -m "feat(events): add public landing URL helper"
```

### Task 2: Render and Test the Landing Access Panel

**Files:**
- Modify: `app/(protected)/events/[id]/edit/page.tsx`
- Create: `app/(protected)/events/[id]/edit/landing-link.tsx`
- Modify: `app/(protected)/events/[id]/edit/page.test.tsx`

**Interfaces:**
- Consumes: `getEventLandingUrl` from Task 1.
- Produces: a visible `landingUrl` field, new-tab link, and copy action above the event navigation.

- [ ] **Step 1: Write failing component tests.**

```tsx
it("passes the encoded landing URL to the client access component", async () => {
  mocks.getEvent.mockResolvedValue(publishedEvent);

  const result = await EditEventPage({ params: Promise.resolve({ id: publishedEvent.id }) });

  expect(JSON.stringify(result)).toContain("https://hub.example.com/events/workshop-mayo");
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm vitest run "app/(protected)/events/[id]/edit/page.test.tsx"`

Expected: FAIL because the edit page does not yet render a public landing URL.

- [ ] **Step 3: Pass the URL from the server page.**

Import `getEventLandingUrl` in `app/(protected)/events/[id]/edit/page.tsx`, calculate:

```typescript
const landingUrl = getEventLandingUrl(env.NEXT_PUBLIC_APP_ORIGIN, event.slug);
```

Render `<LandingLink landingUrl={landingUrl} />` below the event header and before `<EventSubNav />`.

- [ ] **Step 4: Add the client access panel.**

Create `LandingLink` as a Client Component. Render a bordered section containing:

```tsx
<section aria-labelledby="landing-link-heading">
  <h2 id="landing-link-heading">Landing pública</h2>
  <Input readOnly value={landingUrl} aria-label="URL de la landing pública" />
  <a href={landingUrl} target="_blank" rel="noreferrer">Ver landing</a>
  <button type="button" onClick={copyLandingUrl}>Copiar enlace</button>
  {copied ? <span role="status">Enlace copiado</span> : null}
</section>
```

Use the existing `EmbedSettings.copySnippet` pattern: call `navigator.clipboard.writeText(landingUrl)`, set local `copied` state, and keep the success text visible without navigation. The existing browser test setup has no Testing Library dependency, so verify the clipboard interaction manually in the browser.

- [ ] **Step 5: Run focused tests and static checks.**

Run: `pnpm vitest run src/modules/events/embed.test.ts "app/(protected)/events/[id]/edit/page.test.tsx"`

Expected: PASS.

Run: `pnpm lint && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the landing access panel.**

```bash
git add "app/(protected)/events/[id]/edit/page.tsx" "app/(protected)/events/[id]/edit/landing-link.tsx" "app/(protected)/events/[id]/edit/page.test.tsx"
git commit -m "feat(events): add public landing access link"
```

### Task 3: Full Verification

**Files:**
- Verify all files changed by Tasks 1–2.

- [ ] **Step 1: Run the full test suite and build.**

Run: `pnpm check`

Expected: lint, typecheck, all tests, and the production build pass.

- [ ] **Step 2: Verify the user journey manually.**

Open an event edit page and verify that the URL contains the event slug, **Ver landing** opens `/events/<slug>` in a new tab, and **Copiar enlace** shows **Enlace copiado** without reloading. Confirm the existing embed section still works.

## Self-Review

- Spec coverage: URL construction is covered by Task 1; server-to-client wiring and UI behavior by Task 2; regression and manual verification by Task 3.
- Placeholder scan: no unspecified implementation step, `TBD`, or deferred requirement remains.
- Type consistency: `getEventLandingUrl` and `landingUrl` are defined before later tasks consume them.
- Scope: no database, routing, slug, embed, or analytics changes are included.
