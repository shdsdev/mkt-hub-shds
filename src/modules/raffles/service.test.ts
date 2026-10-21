import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, selectMock, transactionMock, updateMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  selectMock: vi.fn(),
  transactionMock: vi.fn(),
  updateMock: vi.fn(),
}));
const notificationMocks = vi.hoisted(() => ({ sendRaffleWinnerEmail: vi.fn() }));

vi.mock("@/db/client", () => ({
  db: { insert: insertMock, select: selectMock, update: updateMock, transaction: transactionMock },
}));

vi.mock("@/modules/users", () => ({
  isAdmin: () => true,
}));
vi.mock("@/modules/notifications", () => notificationMocks);

import {
  drawPrizeUnit,
  expireUnclaimedDraws,
  claimDraw,
  validateRaffleCode,
  getOrCreateRaffle,
  getRaffleLifecycleStatus,
  getPrizeStatusAfterReleasedUnit,
  getPrizeQuantityAfterDecrease,
  isDrawStatusTransitionAllowed,
  isClaimDeadlinePassed,
  releasesPrizeUnit,
  selectEligibleWinners,
  selectNextRafflePrize,
  confirmDrawAndNotify,
  type RandomInt,
  resendHcsWinnerEmail,
} from "./service";

function selectChain<T>(rows: T[]) {
  const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), limit: vi.fn(), orderBy: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  Object.assign(chain, { then: (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve) });
  return chain;
}

function insertChain<T>(rows: T[]) {
  const chain = { values: vi.fn(), onConflictDoNothing: vi.fn(), returning: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);
  return chain;
}

function updateChain<T>(rows: T[]) {
  const chain = { set: vi.fn(), where: vi.fn(), returning: vi.fn() };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);
  return chain;
}

describe("raffle service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends both winner codes when confirming an existing claimed draw", async () => {
    const draw = { id: "draw-1", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "claimed", attendeeEmail: "winner@example.com", attendeeName: "Winner", attendeeCode: "DRAW-456" };
    selectMock
      .mockReturnValueOnce(selectChain([draw]))
      .mockReturnValueOnce(selectChain([{ draw, attendee: { backupCode: "REG-123" }, prize: { name: "Gift", instructions: "Presenta tus códigos.", claimDeadlineAt: null }, event: { name: "Launch" } }]));
    notificationMocks.sendRaffleWinnerEmail.mockResolvedValue({ status: "sent", sentAt: new Date("2026-01-01T00:00:00.000Z") });

    await confirmDrawAndNotify({ drawId: draw.id, eventId: draw.eventId, organizationId: draw.organizationId, actor: { userId: "admin-1", email: "admin@example.com" } });

    expect(notificationMocks.sendRaffleWinnerEmail).toHaveBeenCalledWith(expect.objectContaining({ registrationCode: "REG-123", redemptionCode: "DRAW-456" }));
  });

  it("resends a scoped winner email and returns no attendee PII", async () => {
    const draw = { id: "draw-1", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "claimed", attendeeEmail: "winner@example.com", attendeeName: "Winner <script>" };
    selectMock.mockReturnValue(selectChain([{ draw: { ...draw, attendeeCode: "DRAW-456" }, attendee: { backupCode: "REG-123" }, prize: { name: "Gift" }, event: { name: "Launch" } }]));
    insertMock.mockReturnValue(insertChain([]));
    notificationMocks.sendRaffleWinnerEmail.mockResolvedValue({ status: "resent", sentAt: new Date("2026-01-01T00:00:00.000Z") });

    await expect(resendHcsWinnerEmail({
      drawId: draw.id,
      eventId: draw.eventId,
      organizationId: draw.organizationId,
      connectionId: "connection-1",
      actor: { type: "hcs", actorId: "hcs-actor-1", email: "actor@example.com", name: "Actor", source: "hcs" },
      reason: "Manual resend",
      client: { select: selectMock, insert: insertMock, execute: vi.fn() } as never,
    })).resolves.toEqual({ status: "resent", sentAt: new Date("2026-01-01T00:00:00.000Z") });
    expect(notificationMocks.sendRaffleWinnerEmail).toHaveBeenCalledWith(expect.objectContaining({ drawId: draw.id, to: draw.attendeeEmail, winnerName: draw.attendeeName, eventName: "Launch", prizeName: "Gift", registrationCode: "REG-123", redemptionCode: "DRAW-456" }));
  });

  it("rejects an invalidated draw without sending", async () => {
    const draw = { id: "draw-1", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "invalidated" };
    selectMock.mockReturnValue(selectChain([{ draw, prize: { name: "Gift" }, event: { name: "Launch" } }]));

    await expect(resendHcsWinnerEmail({
      drawId: draw.id,
      eventId: draw.eventId,
      organizationId: draw.organizationId,
      connectionId: "connection-1",
      actor: { type: "hcs", actorId: "hcs-actor-1", email: "actor@example.com", name: "Actor", source: "hcs" },
      reason: null,
      client: { select: selectMock, insert: insertMock, execute: vi.fn() } as never,
    })).rejects.toMatchObject({ status: 409 });
    expect(notificationMocks.sendRaffleWinnerEmail).not.toHaveBeenCalled();
  });

  it("lazily creates one organization-scoped raffle and returns the existing row on conflict", async () => {
    const existing = { id: "raffle-1", eventId: "event-1", organizationId: "org-1", status: "not_configured" };
    const insert = insertChain([existing]);
    insertMock.mockReturnValue(insert);
    selectMock.mockReturnValue(selectChain([{ id: "event-1", organizationId: "org-1" }]));

    await expect(getOrCreateRaffle("event-1", "org-1", "admin-1")).resolves.toEqual(existing);
    expect(insert.values).toHaveBeenCalledWith(expect.objectContaining({ eventId: "event-1", organizationId: "org-1", createdBy: "admin-1" }));
    expect(insert.onConflictDoNothing).toHaveBeenCalledWith({ target: expect.anything() });
  });

  it("does not draw without a matching organization-scoped raffle or prize", async () => {
    selectMock.mockReturnValue(selectChain([]));
    transactionMock.mockImplementation(async (callback: (client: { select: typeof selectMock }) => unknown) => callback({ select: selectMock }));

    await expect(drawPrizeUnit({
      eventId: "event-1",
      organizationId: "org-1",
      prizeId: "prize-1",
      actor: { userId: "admin-1", email: "admin@example.com" },
      idempotencyKey: "draw-1",
      rng: (() => 0) as RandomInt,
    })).rejects.toThrow("Prize not found");
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it("returns the existing draw before checking that the prize is exhausted", async () => {
    const existing = { id: "draw-1", prizeId: "prize-1", status: "claimed" };
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(),
    };
    const scopedChain = selectChain([{ prize: { id: "prize-1", raffleId: "raffle-1", quantity: 1, drawnQuantity: 1, winnerPolicy: "exclude_winners" }, raffle: { id: "raffle-1", eventId: "event-1", status: "finished" } }]);
    const existingChain = selectChain([existing]);
    tx.select.mockReturnValueOnce(scopedChain).mockReturnValueOnce(existingChain);
    transactionMock.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(drawPrizeUnit({
      eventId: "event-1",
      organizationId: "org-1",
      prizeId: "prize-1",
      actor: { userId: "admin-1", email: "admin@example.com" },
      idempotencyKey: "draw-1",
      rng: (() => 0) as RandomInt,
    })).resolves.toEqual(existing);
  });

  it("rejects draws for a paused prize even when the raffle is active", async () => {
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(),
    };
    tx.select
      .mockReturnValueOnce(selectChain([{
        prize: { id: "prize-1", raffleId: "raffle-1", quantity: 1, drawnQuantity: 1, status: "paused", winnerPolicy: "exclude_winners" },
        raffle: { id: "raffle-1", eventId: "event-1", status: "active" },
      }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{
        id: "prize-1",
        raffleId: "raffle-1",
        quantity: 1,
        drawnQuantity: 1,
        status: "paused",
        winnerPolicy: "exclude_winners",
      }]))
      .mockReturnValueOnce(selectChain([{ id: "raffle-1", eventId: "event-1", status: "active" }]));
    transactionMock.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(drawPrizeUnit({
      eventId: "event-1",
      organizationId: "org-1",
      prizeId: "prize-1",
      actor: { userId: "admin-1", email: "admin@example.com" },
      idempotencyKey: "draw-paused-prize",
      rng: (() => 0) as RandomInt,
    })).rejects.toThrow("Prize is paused");
  });

  it("excludes prior winners only when they belong to the same prize", () => {
    const eligible = [{ id: "attendee-1" }, { id: "attendee-2" }, { id: "attendee-3" }];
    expect(selectEligibleWinners(eligible, "exclude_winners", "prize-1", [
      { prizeId: "prize-1", attendeeId: "attendee-1", status: "revealed" },
      { prizeId: "prize-2", attendeeId: "attendee-2", status: "claimed" },
      { prizeId: "prize-1", attendeeId: "attendee-3", status: "invalidated" },
    ])).toEqual([{ id: "attendee-2" }, { id: "attendee-3" }]);
  });

  it("computes the approved raffle lifecycle transitions", () => {
    expect(getRaffleLifecycleStatus({ currentStatus: "not_configured", prizes: [], hasDraws: false })).toBe("not_configured");
    expect(getRaffleLifecycleStatus({ currentStatus: "not_configured", prizes: [{ quantity: 1, drawnQuantity: 0, status: "ready" }], hasDraws: false })).toBe("ready");
    expect(getRaffleLifecycleStatus({ currentStatus: "finished", prizes: [{ quantity: 2, drawnQuantity: 1, status: "active" }], hasDraws: true })).toBe("active");
    expect(getRaffleLifecycleStatus({ currentStatus: "active", prizes: [{ quantity: 1, drawnQuantity: 1, status: "finished" }], hasDraws: true })).toBe("finished");
    expect(getRaffleLifecycleStatus({ currentStatus: "paused", prizes: [{ quantity: 1, drawnQuantity: 0, status: "paused" }], hasDraws: false })).toBe("paused");
  });

  it("selects the first available prize in configured order", () => {
    expect(selectNextRafflePrize([
      { id: "paused", status: "paused", drawnQuantity: 0, quantity: 1 },
      { id: "finished", status: "finished", drawnQuantity: 1, quantity: 1 },
      { id: "next", status: "ready", drawnQuantity: 0, quantity: 2 },
      { id: "later", status: "ready", drawnQuantity: 0, quantity: 1 },
    ])).toEqual({ id: "next", status: "ready", drawnQuantity: 0, quantity: 2 });
  });

  it("recognizes a claim deadline at the deadline instant", () => {
    const deadline = new Date("2026-01-01T12:00:00.000Z");
    expect(isClaimDeadlinePassed(deadline, new Date("2026-01-01T11:59:59.999Z"))).toBe(false);
    expect(isClaimDeadlinePassed(deadline, deadline)).toBe(true);
  });

  it("models expired claims as a released unit while preserving the old draw", () => {
    expect(isDrawStatusTransitionAllowed("revealed", "unclaimed")).toBe(true);
    expect(isDrawStatusTransitionAllowed("unclaimed", "claimed")).toBe(false);
    expect(releasesPrizeUnit("revealed")).toBe(true);
    expect(releasesPrizeUnit("unclaimed")).toBe(false);
    expect(getPrizeStatusAfterReleasedUnit("finished", 0)).toBe("ready");
    expect(getPrizeStatusAfterReleasedUnit("finished", 1)).toBe("active");
  });

  it("does not reduce prize quantity below already drawn units", () => {
    expect(getPrizeQuantityAfterDecrease(8, 4, 1)).toBe(7);
    expect(() => getPrizeQuantityAfterDecrease(4, 4, 1)).toThrow("Prize quantity cannot be lower than drawn units");
  });

  it("commits expiry before reporting that a claim deadline has passed", async () => {
    const draw = { id: "draw-1", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "revealed" };
    const unclaimed = { ...draw, status: "unclaimed" };
    const prize = { id: "prize-1", raffleId: "raffle-1", quantity: 1, drawnQuantity: 1, status: "finished", claimDeadlineAt: new Date("2026-01-01T12:00:00.000Z") };
    const raffle = { id: "raffle-1", eventId: "event-1", organizationId: "org-1", status: "finished" };
    const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(), update: updateMock, insert: insertMock };
    tx.select
      .mockReturnValueOnce(selectChain([draw]))
      .mockReturnValueOnce(selectChain([draw]))
      .mockReturnValueOnce(selectChain([prize]))
      .mockReturnValueOnce(selectChain([raffle]))
      .mockReturnValueOnce(selectChain([{ ...prize, drawnQuantity: 0, status: "ready" }]))
      .mockReturnValueOnce(selectChain([{ id: draw.id }]));
    updateMock
      .mockReturnValueOnce(updateChain([unclaimed]))
      .mockReturnValueOnce(updateChain([]))
      .mockReturnValueOnce(updateChain([{ status: "active" }]));
    insertMock.mockReturnValue(insertChain([]));
    transactionMock.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(claimDraw({
      drawId: draw.id,
      eventId: draw.eventId,
      organizationId: draw.organizationId,
      actor: { userId: "admin-1", email: "admin@example.com" },
      now: new Date("2026-01-01T12:00:00.000Z"),
    })).rejects.toThrow("Claim deadline has passed");
    expect(updateMock).toHaveBeenCalledTimes(3);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it("reloads each prize before releasing multiple expired units", async () => {
    const deadline = new Date("2026-01-01T12:00:00.000Z");
    const draws = [
      { id: "draw-1", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "revealed" },
      { id: "draw-2", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "revealed" },
    ];
    const stalePrize = { id: "prize-1", raffleId: "raffle-1", quantity: 2, drawnQuantity: 2, status: "finished", claimDeadlineAt: deadline };
    const currentPrizes = [
      { ...stalePrize },
      { ...stalePrize, drawnQuantity: 1, status: "active" },
    ];
    const raffle = { id: "raffle-1", eventId: "event-1", organizationId: "org-1", status: "finished" };
    const unclaimed = draws.map((draw) => ({ ...draw, status: "unclaimed" }));
    const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(), update: updateMock, insert: insertMock };
    const selectResults: unknown[][] = [
      draws.map((draw) => ({ draw, prize: stalePrize })),
      [currentPrizes[0]],
      [currentPrizes[0]],
      [{ id: draws[0].id }],
      [raffle],
      [currentPrizes[1]],
      [currentPrizes[1]],
      [{ id: draws[1].id }],
      [raffle],
    ];
    tx.select.mockImplementation(() => selectChain(selectResults.shift() ?? []));
    updateMock.mockImplementation(() => updateChain([unclaimed[0]]));
    insertMock.mockReturnValue(insertChain([]));
    transactionMock.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(expireUnclaimedDraws({
      eventId: "event-1",
      organizationId: "org-1",
      actor: { userId: "admin-1", email: "admin@example.com" },
      now: deadline,
    })).resolves.toBe(2);

    const prizeStatuses = updateMock.mock.results
      .filter((result) => Object.prototype.hasOwnProperty.call(result.value.set.mock.calls[0]?.[0] ?? {}, "drawnQuantity"))
      .map((result) => result.value.set.mock.calls[0]?.[0]?.status)
      .filter((status): status is string => status === "active" || status === "ready");
    expect(prizeStatuses).toEqual(["active", "ready"]);
  });

  it("allows only one conditional transition for concurrent-like state changes", () => {
    expect(isDrawStatusTransitionAllowed("pending_reveal", "revealed")).toBe(true);
    expect(isDrawStatusTransitionAllowed("pending_reveal", "revealed")).toBe(true);
    expect(isDrawStatusTransitionAllowed("claimed", "claimed")).toBe(false);
    expect(isDrawStatusTransitionAllowed("invalidated", "invalidated")).toBe(false);
  });

  it("claims a revealed draw with an external HCS actor without requiring a Hub user", async () => {
    const draw = { id: "draw-1", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "revealed" };
    const claimed = { ...draw, status: "claimed", claimedByExternal: "hcs-actor-1" };
    const prize = { id: "prize-1", claimDeadlineAt: null };
    const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(), update: updateMock, insert: insertMock };
    tx.select
      .mockReturnValueOnce(selectChain([draw]))
      .mockReturnValueOnce(selectChain([draw]))
      .mockReturnValueOnce(selectChain([prize]));
    updateMock.mockReturnValueOnce(updateChain([claimed]));
    insertMock.mockReturnValue(insertChain([]));
    transactionMock.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(claimDraw({
      drawId: draw.id,
      eventId: draw.eventId,
      organizationId: draw.organizationId,
      actor: { type: "hcs", actorId: "hcs-actor-1", email: "actor@example.com", name: "Actor", source: "hcs" },
    })).resolves.toEqual(claimed);
    expect(updateMock.mock.results[0]?.value.set).toHaveBeenCalledWith(expect.objectContaining({ claimedByExternal: "hcs-actor-1", claimedBy: null }));
  });

  it("returns a generic not-found error when no attendee owns the backup code", async () => {
    selectMock.mockReturnValue(selectChain([]));

    await expect(validateRaffleCode({ eventId: "event-1", organizationId: "org-1", connectionId: "connection-1", requestId: "request-1", code: "UNKNOWN1", actor: { type: "hcs", actorId: "hcs-actor-1", email: "actor@example.com", name: "Actor", source: "hcs" } })).rejects.toMatchObject({ status: 404 });
  });

  it("reports an attendee without a non-invalidated draw as having no prize", async () => {
    selectMock
      .mockReturnValueOnce(selectChain([{ attendee: { id: "attendee-1" }, event: { id: "event-1", name: "Launch" } }]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ id: "raffle-1", eventId: "event-1", organizationId: "org-1" }]));
    const auditInsert = insertChain([]);
    insertMock.mockReturnValue(auditInsert);

    await expect(validateRaffleCode({ eventId: "event-1", organizationId: "org-1", connectionId: "connection-1", requestId: "request-1", code: "ABC12345", actor: { type: "hcs", actorId: "hcs-actor-1", email: "actor@example.com", name: "Actor", source: "hcs" } })).resolves.toEqual({ valid: true, hasPrize: false, message: "Participante válido, todavía no tiene premio asignado" });
    expect(auditInsert.values).toHaveBeenCalledWith(expect.objectContaining({ action: "validate", metadata: { connectionId: "connection-1", requestId: "request-1" }, actorExternalId: "hcs-actor-1", actorExternalEmail: "actor@example.com" }));
  });

  it("does not accredit a second concurrent claim after the conditional transition loses", async () => {
    const draw = { id: "draw-1", raffleId: "raffle-1", prizeId: "prize-1", eventId: "event-1", organizationId: "org-1", status: "revealed" };
    const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(), update: updateMock, insert: insertMock };
    tx.select
      .mockReturnValueOnce(selectChain([draw]))
      .mockReturnValueOnce(selectChain([draw]))
      .mockReturnValueOnce(selectChain([{ id: "prize-1", claimDeadlineAt: null }]));
    updateMock.mockReturnValueOnce(updateChain([]));
    transactionMock.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(claimDraw({ drawId: draw.id, eventId: draw.eventId, organizationId: draw.organizationId, actor: { type: "hcs", actorId: "hcs-actor-1", email: "actor@example.com", name: "Actor", source: "hcs" } })).rejects.toThrow("Draw changed concurrently");
  });
});
