import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  canAccessEvent: vi.fn(),
  createPrize: vi.fn(),
  updatePrize: vi.fn(),
  increasePrizeQuantity: vi.fn(),
  drawPrizeUnit: vi.fn(),
  revealDraw: vi.fn(),
  claimDraw: vi.fn(),
  invalidateDraw: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));
vi.mock("@/modules/events", () => ({ canAccessEvent: mocks.canAccessEvent }));
vi.mock("@/modules/raffles", () => ({
  createPrize: mocks.createPrize,
  updatePrize: mocks.updatePrize,
  increasePrizeQuantity: mocks.increasePrizeQuantity,
  drawPrizeUnit: mocks.drawPrizeUnit,
  revealDraw: mocks.revealDraw,
  claimDraw: mocks.claimDraw,
  invalidateDraw: mocks.invalidateDraw,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  claimDrawAction,
  createPrizeAction,
  drawPrizeAction,
  invalidateDrawAction,
} from "./actions";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  profile: { organizationId: "org-1", role: "ADMIN", status: "active" },
};

const ids = {
  event: "11111111-1111-4111-8111-111111111111",
  raffle: "22222222-2222-4222-8222-222222222222",
  prize: "33333333-3333-4333-8333-333333333333",
  draw: "44444444-4444-4444-8444-444444444444",
};

function form(fields: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) result.set(key, value);
  return result;
}

describe("raffle admin actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
  });

  it("rejects a non-admin capability request before mutating", async () => {
    mocks.canAccessEvent.mockResolvedValue(false);

    const result = await createPrizeAction({}, form({ eventId: ids.event, raffleId: ids.raffle, name: "Viaje", quantity: "1" }));

    expect(result).toEqual({ error: "No tienes permiso para administrar este sorteo." });
    expect(mocks.createPrize).not.toHaveBeenCalled();
  });

  it("translates prize fields and comma-separated filters before calling the domain", async () => {
    mocks.createPrize.mockResolvedValue({ id: "prize-1" });
    mocks.drawPrizeUnit.mockResolvedValue({ id: "draw-1" });

    await createPrizeAction({}, form({
      eventId: ids.event,
      raffleId: ids.raffle,
      name: "Viaje",
      quantity: "2",
      claimDeadlineAt: "2026-11-01T18:00",
      instructions: "Presentar identificación",
      fulfillmentContact: "premios@example.com",
      conditions: "Solo asistentes registrados",
      winnerPolicy: "exclude_winners",
    }));
    await drawPrizeAction(form({
      eventId: ids.event,
      prizeId: ids.prize,
      occupation: "Marketing",
      clientBrands: "Acme, Beta",
      interests: "IA, eventos",
    }));

    expect(mocks.createPrize).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 2,
      claimDeadlineAt: new Date("2026-11-01T18:00"),
      winnerPolicy: "exclude_winners",
    }));
    expect(mocks.drawPrizeUnit).toHaveBeenCalledWith(expect.objectContaining({
      filters: { occupation: "Marketing", clientBrands: ["Acme", "Beta"], interests: ["IA", "eventos"] },
      actor: { userId: "admin-1", email: "admin@example.com" },
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/events/${ids.event}/raffle`);
  });

  it("requires a reason when invalidating a draw", async () => {
    const result = await invalidateDrawAction(form({ eventId: "event-1", drawId: "draw-1", reason: " " }));

    expect(result).toEqual({ error: "Indica el motivo de la invalidación." });
    expect(mocks.invalidateDraw).not.toHaveBeenCalled();
  });

  it("passes the actor through when claiming a draw", async () => {
    mocks.claimDraw.mockResolvedValue({ id: "draw-1" });

    await claimDrawAction(form({ eventId: ids.event, drawId: ids.draw }));

    expect(mocks.claimDraw).toHaveBeenCalledWith({
      drawId: ids.draw,
      eventId: ids.event,
      organizationId: "org-1",
      actor: { userId: "admin-1", email: "admin@example.com" },
    });
  });
});
