import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  canAccessEvent: vi.fn(),
  createPrize: vi.fn(),
  updatePrize: vi.fn(),
  increasePrizeQuantity: vi.fn(),
  decreasePrizeQuantity: vi.fn(),
  drawPrizeUnit: vi.fn(),
  drawNextRafflePrize: vi.fn(),
  updateRaffleDrawMode: vi.fn(),
  revealDraw: vi.fn(),
  claimDraw: vi.fn(),
  confirmDrawAndNotify: vi.fn(),
  rotateRaffleStageToken: vi.fn(),
  updateRaffleStageTheme: vi.fn(),
  normalizeRaffleStageTheme: vi.fn((input: { stageBackgroundColor: string; stageAccentColor: string; stageLogoUrl?: string | null }) => ({
    backgroundColor: input.stageBackgroundColor.toLowerCase(),
    accentColor: input.stageAccentColor.toLowerCase(),
    logoUrl: input.stageLogoUrl?.trim() || null,
  })),
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
  decreasePrizeQuantity: mocks.decreasePrizeQuantity,
  drawPrizeUnit: mocks.drawPrizeUnit,
  drawNextRafflePrize: mocks.drawNextRafflePrize,
  updateRaffleDrawMode: mocks.updateRaffleDrawMode,
  revealDraw: mocks.revealDraw,
  claimDraw: mocks.claimDraw,
  confirmDrawAndNotify: mocks.confirmDrawAndNotify,
  rotateRaffleStageToken: mocks.rotateRaffleStageToken,
  updateRaffleStageTheme: mocks.updateRaffleStageTheme,
  normalizeRaffleStageTheme: mocks.normalizeRaffleStageTheme,
  invalidateDraw: mocks.invalidateDraw,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  claimDrawAction,
  createPrizeAction,
  drawPrizeAction,
  drawNextPrizeAction,
  decreasePrizeQuantityAction,
  invalidateDrawAction,
  updateRaffleDrawModeAction,
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
    mocks.confirmDrawAndNotify.mockResolvedValue({ id: "draw-1" });

    await claimDrawAction(form({ eventId: ids.event, drawId: ids.draw }));

    expect(mocks.confirmDrawAndNotify).toHaveBeenCalledWith({
      drawId: ids.draw,
      eventId: ids.event,
      organizationId: "org-1",
      actor: { userId: "admin-1", email: "admin@example.com" },
    });
  });

  it("explains when the selected filters have no eligible attendees", async () => {
    mocks.drawPrizeUnit.mockRejectedValue(new Error("No eligible attendees"));

    const result = await drawPrizeAction(form({ eventId: ids.event, prizeId: ids.prize, occupation: "wholesaler" }));

    expect(result).toEqual({ error: "No hay asistentes elegibles con los filtros seleccionados." });
  });

  it("saves the selected draw mode for an authorized raffle", async () => {
    mocks.updateRaffleDrawMode.mockResolvedValue({ id: ids.raffle, drawMode: "automatic" });

    const result = await updateRaffleDrawModeAction({}, form({ eventId: ids.event, raffleId: ids.raffle, drawMode: "automatic" }));

    expect(result).toEqual({ success: "Modo de sorteo actualizado." });
    expect(mocks.updateRaffleDrawMode).toHaveBeenCalledWith({
      eventId: ids.event,
      raffleId: ids.raffle,
      organizationId: "org-1",
      drawMode: "automatic",
      actor: { userId: "admin-1", email: "admin@example.com" },
    });
  });

  it("draws the next prize through the authenticated admin action", async () => {
    mocks.drawNextRafflePrize.mockResolvedValue({ id: ids.draw });

    const result = await drawNextPrizeAction(form({ eventId: ids.event, idempotencyKey: "55555555-5555-4555-8555-555555555555" }));

    expect(result).toEqual({ success: "Siguiente premio sorteado. Revela el resultado para continuar." });
    expect(mocks.drawNextRafflePrize).toHaveBeenCalledWith({
      eventId: ids.event,
      organizationId: "org-1",
      actor: { userId: "admin-1", email: "admin@example.com" },
      idempotencyKey: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("decreases one unallocated prize unit through the authenticated admin action", async () => {
    mocks.decreasePrizeQuantity.mockResolvedValue({ id: ids.prize, quantity: 1 });

    const result = await decreasePrizeQuantityAction(form({ eventId: ids.event, raffleId: ids.raffle, prizeId: ids.prize, amount: "1" }));

    expect(result).toEqual({ success: "Cantidad actualizada." });
    expect(mocks.decreasePrizeQuantity).toHaveBeenCalledWith({
      eventId: ids.event,
      raffleId: ids.raffle,
      prizeId: ids.prize,
      organizationId: "org-1",
      amount: 1,
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
  });

  it("returns a public stage URL only after an authorized request", async () => {
    mocks.rotateRaffleStageToken.mockResolvedValue({ token: "stage-token" });

    const { rotateRaffleStageTokenAction } = await import("./actions");
    const result = await rotateRaffleStageTokenAction({}, form({ eventId: ids.event }));

    expect(mocks.rotateRaffleStageToken).toHaveBeenCalledWith(ids.event, "org-1");
    expect(result.stageUrl).toContain(`/events/${ids.event}/raffle/stage-token`);
  });

  it("saves a normalized stage theme after authorization", async () => {
    mocks.updateRaffleStageTheme.mockResolvedValue({ id: ids.raffle });

    const { updateRaffleStageThemeAction } = await import("./actions");
    const result = await updateRaffleStageThemeAction({}, form({
      eventId: ids.event,
      raffleId: ids.raffle,
      stageBackgroundColor: "#F4F1EA",
      stageAccentColor: "#BEEF42",
      stageLogoUrl: " https://cdn.example/logo.png ",
    }));

    expect(result).toEqual({ success: "Tema del escenario actualizado." });
    expect(mocks.updateRaffleStageTheme).toHaveBeenCalledWith({
      eventId: ids.event,
      raffleId: ids.raffle,
      organizationId: "org-1",
      stageBackgroundColor: "#f4f1ea",
      stageAccentColor: "#beef42",
      stageLogoUrl: "https://cdn.example/logo.png",
    });
  });
});
