# Event Results Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the event Results page from summary cards into an operational dashboard with registration activity, status distribution, attention items, and recent registrations.

**Architecture:** Extend the events service with one dashboard-data boundary that returns already-scoped aggregates and a bounded recent-registration list. Keep the page as a server component and render the chart in a small client component using the existing Recharts dependency, while keeping status and recent data server-rendered.

**Tech Stack:** Next.js App Router, React server components, Drizzle ORM, PostgreSQL, Recharts, Tailwind CSS, Vitest.

## Global Constraints

- Confirmed capacity counts active attendees attached to confirmed registrations, including primary attendees and companions.
- Pending review, waitlisted, and cancelled registrations do not consume capacity.
- Preserve the dark admin visual system and segmented event navigation.
- Charts include visible labels or legends; color is not the only status signal.
- Keep mobile layout single-column without horizontal overflow.
- Do not modify unrelated `.atl/`, `.codex/`, or email-marketing changes.

## File Map

- Modify `src/modules/events/service.ts` — add dashboard aggregates, activity buckets, attention counts, and bounded recent records.
- Modify `src/modules/events/service.test.ts` — cover dashboard data rules at the service boundary.
- Modify `src/modules/events/index.ts` — export the dashboard service API.
- Create `app/(protected)/events/[id]/dashboard/registration-activity-chart.tsx` — client-only Recharts visualization.
- Modify `app/(protected)/events/[id]/dashboard/page.tsx` — fetch dashboard data and compose sections.
- Modify `app/(protected)/events/[id]/dashboard/page.test.tsx` — assert dashboard sections and empty-state rendering.

### Task 1: Define dashboard data seam

**Files:**
- Modify: `src/modules/events/service.ts`
- Modify: `src/modules/events/index.ts`
- Test: `src/modules/events/service.test.ts`

**Interface:**

```ts
export type EventDashboardData = {
  activity: Array<{ date: string; label: string; registrations: number }>;
  statuses: Array<{ status: "pending_review" | "confirmed" | "waitlisted" | "cancelled"; count: number }>;
  attention: {
    pendingReview: number;
    waitlisted: number;
    confirmedWithoutCheckIn: number;
    requestedCompanions: number;
  };
  recentRegistrations: Array<{
    id: string;
    createdAt: Date;
    status: EventRegistrationRow["status"];
    reviewStatus: EventRegistrationRow["reviewStatus"];
    primaryName: string;
    attendeeCount: number;
  }>;
};

export function getEventDashboardData(eventId: string, organizationId: string): Promise<EventDashboardData | undefined>;
```

- [ ] Write a failing service test with five records spanning pending review, confirmed, waitlisted, and cancelled states, including one confirmed registration with two attendees.
- [ ] Assert recent registrations are newest-first and capped at five.
- [ ] Assert attention counts distinguish confirmed attendees without check-in from confirmed attendees with check-in.
- [ ] Assert activity returns the requested date buckets with zero-filled days and statuses exclude no records from their own category.
- [ ] Run `pnpm exec vitest run src/modules/events/service.test.ts` and verify the new test fails because the service API is absent.
- [ ] Implement the minimal aggregate queries and bounded recent-registration projection using the existing event and organization predicates.
- [ ] Export `getEventDashboardData` from `src/modules/events/index.ts`.
- [ ] Run the service test again and verify it passes.

### Task 2: Add the activity chart

**Files:**
- Create: `app/(protected)/events/[id]/dashboard/registration-activity-chart.tsx`

- [ ] Add a client component that accepts `EventDashboardData["activity"]`.
- [ ] Render a responsive Recharts `BarChart` with date labels, a visible `Registros` label, tooltip, grid, and empty state.
- [ ] Use semantic accent tokens and preserve keyboard/focus behavior around the chart container.
- [ ] Keep the component free of data fetching and avoid adding a second dashboard request.

### Task 3: Compose the operational dashboard

**Files:**
- Modify: `app/(protected)/events/[id]/dashboard/page.tsx`
- Modify: `app/(protected)/events/[id]/dashboard/page.test.tsx`

- [ ] Add a failing page test asserting the presence of `Actividad de registros`, `Requiere atención`, `Estado de registros`, and `Últimos registros`.
- [ ] Fetch dashboard data in parallel with the existing event/insights requests.
- [ ] Render a wide activity chart beside a compact attention panel on desktop and stack them on mobile.
- [ ] Render a status distribution with text counts for `Pendientes`, `Confirmadas`, `Lista de espera`, and `Canceladas`.
- [ ] Render five recent registrations with primary name, attendee count, created date, review/status labels, and a link to the registrations view.
- [ ] Render explicit empty states when no recent registrations or no activity exist.
- [ ] Run the dashboard page test and verify it passes.

### Task 4: Verification

- [ ] Run `pnpm exec vitest run src/modules/events/service.test.ts`.
- [ ] Run `pnpm exec vitest run "app/(protected)/events/[id]/dashboard/page.test.tsx"`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run `impeccable.cmd detect --json` against the changed dashboard files.
- [ ] Review `git diff --check` and confirm unrelated worktree changes remain untouched.
