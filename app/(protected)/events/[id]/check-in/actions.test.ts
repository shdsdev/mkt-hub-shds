import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  checkInAttendee: vi.fn(),
  getEvent: vi.fn(),
  notifyEventWebhook: vi.fn(),
  canAccessEvent: vi.fn(),
  confirmAttendeeCheckIn: vi.fn(),
  lookupAttendeeForCheckIn: vi.fn(),
  lookupBenefitRedemption: vi.fn(),
  listEventBenefitRedemptions: vi.fn(),
  redeemBenefit: vi.fn(),
  checkRateLimit: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));
vi.mock("@/modules/audit", () => ({ checkRateLimit: mocks.checkRateLimit, recordAudit: mocks.recordAudit }));
vi.mock("@/modules/events", () => ({
  checkInAttendee: mocks.checkInAttendee,
  getEvent: mocks.getEvent,
  notifyEventWebhook: mocks.notifyEventWebhook,
  canAccessEvent: mocks.canAccessEvent,
  confirmAttendeeCheckIn: mocks.confirmAttendeeCheckIn,
  lookupAttendeeForCheckIn: mocks.lookupAttendeeForCheckIn,
  lookupBenefitRedemption: mocks.lookupBenefitRedemption,
  listEventBenefitRedemptions: mocks.listEventBenefitRedemptions,
  redeemBenefit: mocks.redeemBenefit,
}));

import { checkInAction, listBenefitRedemptionsAction, lookupBenefitRedemptionAction, redeemBenefitAction } from "./actions";

const activeUser = {
  id: "staff-1",
  email: "staff@example.com",
  profile: {
    id: "staff-1",
    organizationId: "org-1",
    role: "MARKETING_USER",
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
};

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

function formData(eventId: string, code: string) {
  const fd = new FormData();
  fd.set("eventId", eventId);
  fd.set("code", code);
  return fd;
}

describe("checkInAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(activeUser);
    mocks.isActive.mockReturnValue(true);
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, webhookUrl: null, webhookSecret: null });
    mocks.notifyEventWebhook.mockResolvedValue(undefined);
  });

  it("rejects when there is no active session, without calling the service", async () => {
    mocks.getCurrentUser.mockResolvedValue(undefined);

    const result = await checkInAction({}, formData(EVENT_ID, "ABCD1234"));

    expect(result.error).toBeTruthy();
    expect(mocks.checkInAttendee).not.toHaveBeenCalled();
  });

  it("rejects when the session is inactive", async () => {
    mocks.isActive.mockReturnValue(false);

    const result = await checkInAction({}, formData(EVENT_ID, "ABCD1234"));

    expect(result.error).toBeTruthy();
    expect(mocks.checkInAttendee).not.toHaveBeenCalled();
  });

  it("treats an 8-character code as a backup code", async () => {
    mocks.checkInAttendee.mockResolvedValue({
      ok: true,
      alreadyCheckedIn: false,
      attendee: { fullName: "Ada Lovelace" },
    });

    await checkInAction({}, formData(EVENT_ID, "abcd1234"));

    expect(mocks.checkInAttendee).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      checkedInBy: "staff-1",
      backupCode: "ABCD1234",
    });
  });

  it("treats a longer code as a QR pass token", async () => {
    const longToken = "a".repeat(43);
    mocks.checkInAttendee.mockResolvedValue({
      ok: true,
      alreadyCheckedIn: false,
      attendee: { fullName: "Ada Lovelace" },
    });

    await checkInAction({}, formData(EVENT_ID, longToken));

    expect(mocks.checkInAttendee).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      checkedInBy: "staff-1",
      passToken: longToken,
    });
  });

  it("returns a not-found message when the service finds no attendee", async () => {
    mocks.checkInAttendee.mockResolvedValue({ ok: false, reason: "not_found" });

    const result = await checkInAction({}, formData(EVENT_ID, "ABCD1234"));

    expect(result.error).toBeTruthy();
  });

  it("surfaces the attendee name and already-checked-in flag on success", async () => {
    mocks.checkInAttendee.mockResolvedValue({
      ok: true,
      alreadyCheckedIn: true,
      attendee: { fullName: "Ada Lovelace" },
    });

    const result = await checkInAction({}, formData(EVENT_ID, "ABCD1234"));

    expect(result).toEqual({ success: true, alreadyCheckedIn: true, attendeeName: "Ada Lovelace" });
  });

  it("notifies the event webhook on a genuine first check-in", async () => {
    mocks.checkInAttendee.mockResolvedValue({
      ok: true,
      alreadyCheckedIn: false,
      attendee: { id: "att-1", fullName: "Ada Lovelace", email: "ada@example.com" },
    });

    await checkInAction({}, formData(EVENT_ID, "ABCD1234"));

    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ id: EVENT_ID }),
      "attendee.checked_in",
      expect.objectContaining({ attendeeId: "att-1" }),
    );
  });

  it("does not notify the webhook on an idempotent re-scan", async () => {
    mocks.checkInAttendee.mockResolvedValue({
      ok: true,
      alreadyCheckedIn: true,
      attendee: { id: "att-1", fullName: "Ada Lovelace" },
    });

    await checkInAction({}, formData(EVENT_ID, "ABCD1234"));

    expect(mocks.notifyEventWebhook).not.toHaveBeenCalled();
    expect(mocks.getEvent).not.toHaveBeenCalled();
  });

  it("looks up a benefit with the normalized backup-code contract for assigned reception", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...activeUser, profile: { ...activeUser.profile, role: "RECEPTION" } });
    mocks.lookupBenefitRedemption.mockResolvedValue({ ok: true, benefits: [], redemption: null });

    const result = await lookupBenefitRedemptionAction(formData(EVENT_ID, "abcd1234"));

    expect(result).toEqual({ ok: true, result: { ok: true, benefits: [], redemption: null } });
    expect(mocks.canAccessEvent).toHaveBeenCalledWith(expect.objectContaining({ capability: "benefit-redemption" }));
    expect(mocks.lookupBenefitRedemption).toHaveBeenCalledWith({ eventId: EVENT_ID, code: "ABCD1234" });
  });

  it("rejects an unassigned reception user before benefit lookup", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...activeUser, profile: { ...activeUser.profile, role: "RECEPTION" } });
    mocks.canAccessEvent.mockResolvedValue(false);

    const result = await lookupBenefitRedemptionAction(formData(EVENT_ID, "ABCD1234"));

    expect(result).toEqual({ ok: false, error: "No tienes permiso para operar los beneficios." });
    expect(mocks.lookupBenefitRedemption).not.toHaveBeenCalled();
  });

  it("lists only the authorized event redemption history with an explicit permission state", async () => {
    const history = [{ id: "redemption-1", eventId: EVENT_ID }];
    mocks.listEventBenefitRedemptions.mockResolvedValue(history);

    const result = await listBenefitRedemptionsAction(form({ eventId: EVENT_ID }));

    expect(result).toEqual({ ok: true, history });
    expect(mocks.canAccessEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT_ID, capability: "benefit-redemption" }));
    expect(mocks.listEventBenefitRedemptions).toHaveBeenCalledWith(EVENT_ID);

    mocks.canAccessEvent.mockResolvedValue(false);
    const denied = await listBenefitRedemptionsAction(form({ eventId: EVENT_ID }));

    expect(denied).toEqual({ ok: false, error: "No tienes permiso para operar los beneficios." });
    expect(mocks.listEventBenefitRedemptions).toHaveBeenCalledTimes(1);
  });

  it("returns explicit redemption messages and audits a successful redemption", async () => {
    mocks.redeemBenefit.mockResolvedValue({ ok: true, redemption: { id: "redemption-1" } });

    const result = await redeemBenefitAction(form({ eventId: EVENT_ID, benefitId: "22222222-2222-4222-8222-222222222222", code: "abcd1234" }));

    expect(result).toEqual({ success: true, message: "Beneficio canjeado correctamente." });
    expect(mocks.redeemBenefit).toHaveBeenCalledWith(expect.objectContaining({ code: "ABCD1234", actorId: "staff-1" }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "create", resourceType: "event_benefit_redemption", resourceId: "redemption-1" }));
  });

  it("explains missing check-in, duplicate redemption, and exhausted stock", async () => {
    for (const reason of ["not_checked_in", "already_redeemed", "stock_exhausted"] as const) {
      mocks.redeemBenefit.mockResolvedValue({ ok: false, reason });
      const result = await redeemBenefitAction(form({ eventId: EVENT_ID, benefitId: "22222222-2222-4222-8222-222222222222", code: "ABCD1234" }));
      expect(result.error).toBeTruthy();
    }
  });

  it("rejects redemption when the mutation rate limit is exhausted", async () => {
    mocks.checkRateLimit.mockReturnValue(false);

    const result = await redeemBenefitAction(form({ eventId: EVENT_ID, benefitId: "22222222-2222-4222-8222-222222222222", code: "ABCD1234" }));

    expect(result).toEqual({ error: "Demasiadas acciones. Inténtalo de nuevo en breve." });
    expect(mocks.redeemBenefit).not.toHaveBeenCalled();
  });

  function form(fields: Record<string, string>) {
    const result = new FormData();
    for (const [key, value] of Object.entries(fields)) result.set(key, value);
    return result;
  }
});
