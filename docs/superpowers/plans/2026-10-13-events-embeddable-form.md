# Events Embeddable Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose each published event's registration form as a copyable iframe snippet that works in WordPress, Wix, Webflow, and plain HTML while preserving the Hub's existing registration flow.

**Architecture:** Add a public `/events/embed/[slug]` route that renders the existing `RegisterForm` and reuses `registerForEventAction`. Add a small pure embed-snippet helper for deterministic URL/HTML generation, then expose that snippet from the protected event editor through a client copy component. No database migration or third-party site-builder plugin is needed.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5, Vitest 5, Tailwind CSS 4, existing events service/actions, `NEXT_PUBLIC_APP_ORIGIN`.

## Global Constraints

- Embed only the registration form; do not embed the complete event landing page.
- Resolve public events with `getPublishedEventBySlugPublic(slug)` and allow only `published` events.
- Reuse `RegisterForm` and `registerForEventAction`; do not create a second registration API or client-side registration flow.
- Preserve companion attendees, optional fields, capacity, waitlist, duplicate-email validation, UTMs, confirmation emails with QR passes, and outbound webhooks.
- Do not expose event IDs, organization IDs, webhook URLs, webhook secrets, or administrative actions.
- Use a safe iframe minimum height initially; do not add cross-origin auto-resizing in this change.
- Add a hidden honeypot field without replacing server-side validation.
- Follow the repository's existing Vitest patterns and run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` before completion.

---

### Task 1: Add Deterministic Embed Snippet Helpers

**Files:**
- Create: `src/modules/events/embed.ts`
- Create: `src/modules/events/embed.test.ts`
- Modify: `src/modules/events/index.ts`

**Interfaces:**
- Consumes: `origin: string`, `slug: string`.
- Produces: `getEventEmbedUrl(origin, slug): string` and `getEventEmbedSnippet(origin, slug): string`.

- [ ] **Step 1: Write the failing helper tests**

Create tests covering trailing-slash normalization and HTML escaping of the event slug:

```typescript
import { describe, expect, it } from "vitest";
import { getEventEmbedSnippet, getEventEmbedUrl } from "./embed";

describe("event embed helpers", () => {
  it("builds the public embed URL without a duplicate slash", () => {
    expect(getEventEmbedUrl("https://hub.example.com/", "workshop-mayo")).toBe(
      "https://hub.example.com/events/embed/workshop-mayo",
    );
  });

  it("builds a copyable iframe snippet with safe defaults", () => {
    expect(getEventEmbedSnippet("https://hub.example.com", "workshop-mayo")).toBe(
      `<iframe src="https://hub.example.com/events/embed/workshop-mayo" style="width:100%;min-height:760px;border:0" loading="lazy" title="Formulario de registro"></iframe>`,
    );
  });

  it("encodes a slug before placing it in the URL", () => {
    expect(getEventEmbedUrl("https://hub.example.com", "workshop mayo")).toBe(
      "https://hub.example.com/events/embed/workshop%20mayo",
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec vitest run --passWithNoTests "src/modules/events/embed.test.ts"`

Expected: FAIL because `./embed` and its exported functions do not exist yet.

- [ ] **Step 3: Implement the minimal pure helper**

Implement the URL once and derive the snippet from it. Use `encodeURIComponent(slug)` and `origin.replace(/\/$/, "")`; do not read request headers or environment variables inside this module so it remains deterministic and unit-testable.

- [ ] **Step 4: Export the helper through the events module boundary**

Update `src/modules/events/index.ts` to export the two helper functions alongside the existing public events exports. Keep route and protected UI imports pointed at `@/modules/events`, not the internal file.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `pnpm exec vitest run --passWithNoTests "src/modules/events/embed.test.ts"`

Expected: PASS with all embed helper tests passing.

- [ ] **Step 6: Commit the helper unit**

```bash
git add src/modules/events/embed.ts src/modules/events/embed.test.ts src/modules/events/index.ts
git commit -m "feat(events): add embeddable form snippet helpers"
```

### Task 2: Add the Public Embed Route

**Files:**
- Create: `app/events/embed/[slug]/page.tsx`
- Create: `app/events/embed/[slug]/page.test.tsx`

**Interfaces:**
- Consumes: `getPublishedEventBySlugPublic`, `RegisterForm`, and query keys `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `utm_id`.
- Produces: a public route at `/events/embed/[slug]` that renders only the form or a controlled unavailable message.

- [ ] **Step 1: Write route tests for the public contract**

Mock `@/modules/events` and `./register-form` using the same pattern as `app/events/[id]/page.test.tsx`. Cover these cases:

```typescript
it("renders only the registration form for a published event", async () => {
  mocks.getPublishedEventBySlugPublic.mockResolvedValue(publishedEvent);

  const result = await EmbedEventPage({
    params: Promise.resolve({ slug: "workshop-marketing" }),
    searchParams: Promise.resolve({ utm_source: "newsletter" }),
  });

  expect(JSON.stringify(result)).toContain("workshop-marketing");
  expect(JSON.stringify(result)).toContain("newsletter");
  expect(JSON.stringify(result)).not.toContain("Agenda");
  expect(mocks.getPublishedEventBySlugPublic).toHaveBeenCalledWith("workshop-marketing");
});

it("renders a controlled unavailable state for a draft, closed, or unknown event", async () => {
  mocks.getPublishedEventBySlugPublic.mockResolvedValue(undefined);

  const result = await EmbedEventPage({
    params: Promise.resolve({ slug: "workshop-marketing" }),
    searchParams: Promise.resolve({}),
  });

  expect(JSON.stringify(result)).toMatch(/no está disponible/i);
  expect(JSON.stringify(result)).not.toContain("event-1");
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run: `pnpm exec vitest run --passWithNoTests "app/events/embed/[slug]/page.test.tsx"`

Expected: FAIL because the embed route does not exist.

- [ ] **Step 3: Implement the route with the existing public event query**

Create an async page that:

1. Awaits `params` and `searchParams`.
2. Calls `getPublishedEventBySlugPublic(slug)`.
3. Returns a small styled unavailable section when the event is absent.
4. Builds the same six-field UTM object used by the existing public landing page.
5. Renders a `min-h-screen` wrapper with padding and only `RegisterForm`, passing `slug`, `collectCompany`, `collectJobTitle`, and `utm`.

Do not call `recordEventVisit`; the embed is a form surface, not the landing-page visit counter.

- [ ] **Step 4: Run the route test and verify it passes**

Run: `pnpm exec vitest run --passWithNoTests "app/events/embed/[slug]/page.test.tsx"`

Expected: PASS with the published and unavailable cases passing.

- [ ] **Step 5: Commit the public route**

```bash
git add "app/events/embed/[slug]/page.tsx" "app/events/embed/[slug]/page.test.tsx"
git commit -m "feat(events): add public embeddable registration route"
```

### Task 3: Add Honeypot Protection Without Changing Registration Semantics

**Files:**
- Modify: `app/events/[id]/register-form.tsx`
- Modify: `app/events/[id]/actions.ts`

**Interfaces:**
- Consumes: a hidden `website` form field.
- Produces: normal users remain on the existing registration flow; submissions with a non-empty honeypot create no registration, send no email, and send no webhook.

- [ ] **Step 1: Add the failing action test**

Extend `app/events/[id]/actions.test.ts` with:

```typescript
it("ignores submissions that fill the honeypot field", async () => {
  const result = await registerForEventAction({}, baseFormData({ website: "https://spam.example" }));

  expect(result).toEqual({ success: true, status: "confirmed" });
  expect(mocks.registerForEvent).not.toHaveBeenCalled();
  expect(mocks.notifyEventWebhook).not.toHaveBeenCalled();
  expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused action test and verify it fails**

Run: `pnpm exec vitest run --passWithNoTests "app/events/[id]/actions.test.ts"`

Expected: FAIL because the action currently ignores no honeypot field.

- [ ] **Step 3: Implement the honeypot field and server guard**

Add an off-screen, accessible-to-automation-resistant input named `website` to `RegisterForm`. At the beginning of `registerForEventAction`, before resolving the event or executing side effects, return `{ success: true, status: "confirmed" }` when the trimmed `website` value is non-empty. Keep all existing validation and registration behavior unchanged for an empty value.

- [ ] **Step 4: Run the focused action test and verify it passes**

Run: `pnpm exec vitest run --passWithNoTests "app/events/[id]/actions.test.ts"`

Expected: PASS, including all existing registration, companion, waitlist, duplicate-email, email, and webhook assertions.

- [ ] **Step 5: Commit the anti-spam guard**

```bash
git add "app/events/[id]/register-form.tsx" "app/events/[id]/actions.ts" "app/events/[id]/actions.test.ts"
git commit -m "feat(events): add registration form honeypot"
```

### Task 4: Expose the Snippet in Event Editing

**Files:**
- Create: `app/(protected)/events/[id]/edit/embed-settings.tsx`
- Modify: `app/(protected)/events/[id]/edit/page.tsx`
- Modify: `app/(protected)/events/[id]/edit/event-edit-form.tsx`

**Interfaces:**
- Consumes: `embedUrl: string` and `embedSnippet: string` computed on the server with `env.NEXT_PUBLIC_APP_ORIGIN`, `getEventEmbedUrl`, and `getEventEmbedSnippet`.
- Produces: an admin-only “Formulario embebible” section with URL, read-only snippet, copy action, and preview link.

- [ ] **Step 1: Add a focused pure-output assertion before UI work**

Use the helper tests from Task 1 as the contract for URL and snippet output. Do not duplicate string construction in the client component.

- [ ] **Step 2: Implement the client presentation component**

Create `EmbedSettings` with props `{ embedUrl: string; embedSnippet: string }`. Render:

```tsx
<section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
  <div>
    <h2 className="text-sm font-medium">Formulario embebible</h2>
    <p className="text-sm text-muted-foreground">Copiá este código para insertarlo en otro sitio.</p>
  </div>
  <Input readOnly value={embedUrl} aria-label="URL del formulario embebible" />
  <textarea readOnly value={embedSnippet} aria-label="Código HTML del formulario embebible" />
  <div className="flex gap-2">
    <Button type="button" onClick={() => navigator.clipboard.writeText(embedSnippet)}>
      Copiar código
    </Button>
    <Button type="button" variant="outline" asChild>
      <a href={embedUrl} target="_blank" rel="noreferrer">Vista previa</a>
    </Button>
  </div>
</section>
```

Use the repository's existing UI primitives and Spanish UI copy. The copy action must not submit the event edit form.

- [ ] **Step 3: Pass server-generated values into the client form**

In `app/(protected)/events/[id]/edit/page.tsx`, import `env` from `@/lib/env` and the two public embed helpers. Build the URL and snippet from `env.NEXT_PUBLIC_APP_ORIGIN` and `event.slug`, then pass both props through `EventEditForm`.

In `EventEditForm`, accept the two string props, import `EmbedSettings`, and render it after `WebhookSettings`. The protected page already enforces active-admin authorization, so no new authorization path is needed.

- [ ] **Step 4: Run lint and typecheck for the UI changes**

Run: `pnpm lint`

Expected: exit code 0 with no new lint violations.

Run: `pnpm typecheck`

Expected: exit code 0 with the new props and imports type-checking successfully.

- [ ] **Step 5: Commit the admin embed section**

```bash
git add "app/(protected)/events/[id]/edit/embed-settings.tsx" "app/(protected)/events/[id]/edit/page.tsx" "app/(protected)/events/[id]/edit/event-edit-form.tsx"
git commit -m "feat(events): expose embeddable form code in editor"
```

### Task 5: Verify the Complete Embed Contract

**Files:**
- Verify: `app/events/embed/[slug]/page.test.tsx`
- Verify: `app/events/[id]/actions.test.ts`
- Verify: `src/modules/events/embed.test.ts`

**Interfaces:**
- Consumes: all route, helper, action, and editor behavior from Tasks 1-4.
- Produces: verified embed behavior and documented evidence for the final delivery.

- [ ] **Step 1: Run the complete event-focused test set**

Run: `pnpm exec vitest run --passWithNoTests "app/events" "src/modules/events"`

Expected: all event route, action, service, database, helper, and related tests pass.

- [ ] **Step 2: Run repository quality checks**

Run each command separately:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: each command exits with code 0.

- [ ] **Step 3: Perform manual external-site verification**

Create or use a plain HTML page containing the generated iframe snippet. Verify the following against a published event:

- The form loads without depending on the host page's CSS.
- Mobile and desktop widths remain usable.
- Primary registration succeeds and produces the existing confirmation state.
- Companion fields can be added and submitted.
- Optional company and job-title fields match event configuration.
- UTM query parameters on the iframe URL reach the registration record.
- A full event shows the waitlist state.
- Duplicate email and invalid data show the existing friendly errors.
- The confirmation email and configured webhook still run.
- A closed event displays the unavailable state and creates no registration.

- [ ] **Step 4: Inspect the final diff and status**

Run:

```bash
git status --short
```

Expected: only the intended embed feature files and tests are included in the feature commits; unrelated pre-existing worktree changes remain untouched.

- [ ] **Step 5: Record verification corrections when required**

If a test exposes an implementation defect, add the regression assertion to the specific failing test file, fix the implementation, rerun the failing command, and commit only the corrected files with:

```bash
git add "app/events/embed/[slug]/page.test.tsx" "app/events/[id]/actions.test.ts" "src/modules/events/embed.test.ts" "app/events/embed/[slug]/page.tsx" "app/events/[id]/actions.ts" "src/modules/events/embed.ts"
git commit -m "fix(events): correct embeddable form verification"
```

If all verification commands pass without corrections, do not create an empty commit.
