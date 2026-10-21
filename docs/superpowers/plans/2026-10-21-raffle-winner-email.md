# Raffle Winner Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain raffle winner email with a branded operational email containing the attendee registration code and the per-prize redemption code, without changing HCS code or contracts.

**Architecture:** Extend the existing notification service with a pure, testable HTML renderer. Extend the two Marketing Hub raffle notification paths to join `event_attendees.backupCode`; continue using `raffle_draws.attendeeCode` as the per-prize redemption code. Keep notification idempotency, Resend delivery, audit behavior, and HCS routes unchanged.

**Tech Stack:** TypeScript, Next.js services, Drizzle ORM, Vitest, Resend REST API, table-based HTML email with inline styles.

## Global Constraints

- Do not modify HCS application code, API routes, request/response contracts, authentication, or claim semantics.
- Keep the existing notification log and resend idempotency behavior.
- Escape every dynamic value before embedding it in HTML.
- Keep visible email copy in Spanish.
- Do not include monitoring work in this change.
- Do not include `.atl/` or `.codex/` in commits.

---

### Task 1: Add the branded winner-email renderer

**Files:**
- Modify: `src/modules/notifications/service.ts:164-226`
- Test: `src/modules/notifications/raffle-winner.test.ts`

**Interfaces:**
- Extend `RaffleWinnerEmailInput` with required `registrationCode: string` and `redemptionCode: string`.
- Add `renderRaffleWinnerEmailHtml(input)` as a pure function that returns escaped HTML.
- Keep `sendRaffleWinnerEmail(input)` responsible for notification logging, idempotency, and provider delivery.

- [ ] **Step 1: Write the failing renderer test**

```ts
it("renders separate registration and redemption codes", () => {
  const html = renderRaffleWinnerEmailHtml({
    winnerName: "Javier <Test>",
    winnerEmail: "javier@example.com",
    eventName: "Shades Spaces",
    prizeName: "Motor 45 mm",
    registrationCode: "REG-123",
    redemptionCode: "PREM-456",
    instructions: "Presenta este código en el módulo de entrega.",
    claimDeadlineAt: new Date("2026-12-30T18:18:00.000Z"),
  });

  expect(html).toContain("Código de registro");
  expect(html).toContain("Código de canje");
  expect(html).toContain("REG-123");
  expect(html).toContain("PREM-456");
  expect(html).toContain("Javier &lt;Test&gt;");
  expect(html).not.toContain("Javier <Test>");
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
pnpm vitest run src/modules/notifications/raffle-winner.test.ts
```

Expected: FAIL because the renderer and fields do not exist yet.

- [ ] **Step 3: Implement the renderer**

Create a table-based `lang="es-MX"` template with inline styles and a 600px responsive container. It must include:

- `Shades Spaces` header and event name.
- `¡Felicidades, [nombre]!` headline.
- Prize highlight card.
- Winner name and email.
- Separate `Código de registro` block for `backupCode`.
- Separate, more prominent `Código de canje` block for `attendeeCode`.
- Instructions, deadline, and `Pendiente de canje` status.
- Footer identifying `Shades de México` as official sponsor.
- Hidden preheader and escaped dynamic values.

The pure renderer input must be:

```ts
type RaffleWinnerEmailRenderInput = {
  winnerName: string;
  winnerEmail: string;
  eventName: string;
  prizeName: string;
  registrationCode: string;
  redemptionCode: string;
  reason?: string | null;
  instructions?: string | null;
  claimDeadlineAt?: Date | null;
};
```

- [ ] **Step 4: Use the renderer in `sendRaffleWinnerEmail`**

```ts
const html = renderRaffleWinnerEmailHtml({
  winnerName: input.winnerName,
  winnerEmail: input.winnerEmail,
  eventName: input.eventName,
  prizeName: input.prizeName,
  registrationCode: input.registrationCode,
  redemptionCode: input.redemptionCode,
  reason: input.reason,
  instructions: input.instructions,
  claimDeadlineAt: input.claimDeadlineAt,
});
```

Preserve the existing subject, provider call, notification status transitions, and resend behavior.

- [ ] **Step 5: Run notification tests**

```bash
pnpm vitest run src/modules/notifications/raffle-winner.test.ts
```

Expected: PASS.

### Task 2: Supply both codes on the first-send path

**Files:**
- Modify: `src/modules/raffles/service.ts:564-574`
- Test: `src/modules/raffles/service.test.ts`

- [ ] **Step 1: Add a failing assertion to the confirm-notify test**

The joined test row must include `attendee: { backupCode: "REG-123" }`. Assert:

```ts
expect(sendRaffleWinnerEmail).toHaveBeenCalledWith(expect.objectContaining({
  registrationCode: "REG-123",
  redemptionCode: "DRAW-456",
}));
```

- [ ] **Step 2: Run the focused service test**

```bash
pnpm vitest run src/modules/raffles/service.test.ts
```

Expected: FAIL because the current query does not join attendees or pass either field.

- [ ] **Step 3: Extend the scoped query**

In `confirmDrawAndNotify`, join `eventAttendees` with `eventAttendees.id = raffleDraws.attendeeId`, scope the attendee to the same organization, and pass:

```ts
registrationCode: scoped.attendee.backupCode,
redemptionCode: draw.attendeeCode,
```

If the attendee row is missing, throw `Attendee not found` and do not send an incomplete email.

- [ ] **Step 4: Run the focused service test**

```bash
pnpm vitest run src/modules/raffles/service.test.ts
```

Expected: PASS.

### Task 3: Supply both codes on the HCS resend path

**Files:**
- Modify: `src/modules/raffles/service.ts:620-651`
- Test: `src/modules/raffles/service.test.ts`

- [ ] **Step 1: Add a failing resend assertion**

Include the joined attendee backup code and assert the same `registrationCode` and `redemptionCode` fields passed to the notification service.

- [ ] **Step 2: Run the resend test**

```bash
pnpm vitest run src/modules/raffles/service.test.ts -t "resend"
```

Expected: FAIL because the current resend query joins only draw, prize, and event.

- [ ] **Step 3: Extend only the Marketing Hub query**

Join and scope `eventAttendees` exactly as Task 2. Keep the HCS resend route, request schema, generic response, rate limit, idempotency, and audit behavior unchanged.

- [ ] **Step 4: Run the resend test**

```bash
pnpm vitest run src/modules/raffles/service.test.ts -t "resend"
```

Expected: PASS.

### Task 4: Verify and deliver the email work unit

**Files:**
- Production: `src/modules/notifications/service.ts`, `src/modules/raffles/service.ts`
- Tests: `src/modules/notifications/raffle-winner.test.ts`, `src/modules/raffles/service.test.ts`
- Docs: `docs/superpowers/specs/2026-10-21-raffle-winner-email-design.md`, this plan

- [ ] **Step 1: Run focused tests**

```bash
pnpm vitest run src/modules/notifications/raffle-winner.test.ts src/modules/raffles/service.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run static checks and build**

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Expected: all commands exit with status 0.

- [ ] **Step 3: Confirm HCS files are untouched**

```bash
git diff --name-only d2cbbfe -- app/api/integrations/hcs src/modules/integrations
```

Expected: no files listed.

- [ ] **Step 4: Inspect rendered HTML**

Verify the generated HTML at desktop and narrow email widths, including long names, long instructions, missing deadline, and HTML-special characters.

- [ ] **Step 5: Commit only this work unit**

```bash
git add src/modules/notifications/service.ts src/modules/notifications/raffle-winner.test.ts src/modules/raffles/service.ts src/modules/raffles/service.test.ts docs/superpowers/specs/2026-10-21-raffle-winner-email-design.md docs/superpowers/plans/2026-10-21-raffle-winner-email.md
git commit -m "feat(raffle): send branded winner redemption emails"
```

Do not stage `.atl/`, `.codex/`, monitoring files, or unrelated worktree changes.

## Coordination With Monitoring Agent

- Monitoring starts from `d2cbbfe` in `C:\Users\javier.enriquez\Desktop\PROYECTOS\MKT\hub mkt-worktrees\monitoring-sentry-telegram` on branch `feat/monitoring-sentry-telegram`.
- Monitoring must not edit the notification/raffle files in this plan unless explicitly coordinated.
- Integrate both commits after each work unit passes its own verification.
- Push the same final history to `origin/dev` and `origin/master` so both branches remain aligned.
