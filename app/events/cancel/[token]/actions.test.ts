import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelRegistrationByToken: vi.fn(),
  getEvent: vi.fn(),
  sendWaitlistPromotionEmail: vi.fn(),
  exportQrPng: vi.fn(),
}));

vi.mock("@/modules/events", () => ({
  cancelRegistrationByToken: mocks.cancelRegistrationByToken,
  getEvent: mocks.getEvent,
}));
vi.mock("@/modules/notifications", () => ({
  sendWaitlistPromotionEmail: mocks.sendWaitlistPromotionEmail,
}));
vi.mock("@/modules/qr", () => ({
  exportQrPng: mocks.exportQrPng,
}));

import { cancelRegistrationAction } from "./actions";

function formDataWithToken(token: string) {
  const fd = new FormData();
  fd.set("token", token);
  return fd;
}

describe("cancelRegistrationAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendWaitlistPromotionEmail.mockResolvedValue({ sent: true, notificationId: "n1" });
  });

  it("returns an error without calling the service when the token field is missing", async () => {
    const result = await cancelRegistrationAction({}, new FormData());

    expect(result.error).toBeTruthy();
    expect(mocks.cancelRegistrationByToken).not.toHaveBeenCalled();
  });

  it("surfaces invalid_token as a friendly message", async () => {
    mocks.cancelRegistrationByToken.mockResolvedValue({ ok: false, reason: "invalid_token" });

    const result = await cancelRegistrationAction({}, formDataWithToken("unknown"));

    expect(result.error).toBeTruthy();
    expect(mocks.sendWaitlistPromotionEmail).not.toHaveBeenCalled();
  });

  it("surfaces already_cancelled as a friendly message", async () => {
    mocks.cancelRegistrationByToken.mockResolvedValue({ ok: false, reason: "already_cancelled" });

    const result = await cancelRegistrationAction({}, formDataWithToken("cancel-token-1"));

    expect(result.error).toBeTruthy();
  });

  it("cancels and sends no promotion email when nobody is promoted", async () => {
    mocks.cancelRegistrationByToken.mockResolvedValue({
      ok: true,
      registration: { id: "reg-1" },
    });

    const result = await cancelRegistrationAction({}, formDataWithToken("cancel-token-1"));

    expect(result.success).toBe(true);
    expect(mocks.sendWaitlistPromotionEmail).not.toHaveBeenCalled();
    expect(mocks.getEvent).not.toHaveBeenCalled();
  });

  it("sends a waitlist-promotion email per promoted attendee", async () => {
    mocks.cancelRegistrationByToken.mockResolvedValue({
      ok: true,
      registration: { id: "reg-1" },
      promoted: {
        registration: { id: "reg-2", eventId: "event-1", organizationId: "org-1" },
        attendees: [
          {
            id: "att-2",
            organizationId: "org-1",
            email: "alan@example.com",
            fullName: "Alan Turing",
            passToken: "pass-token-2",
            backupCode: "WXYZ5678",
          },
        ],
      },
    });
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });

    const result = await cancelRegistrationAction({}, formDataWithToken("cancel-token-1"));

    expect(mocks.getEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(mocks.exportQrPng).toHaveBeenCalledWith("pass-token-2", {});
    expect(mocks.sendWaitlistPromotionEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        attendeeId: "att-2",
        to: "alan@example.com",
        attendeeName: "Alan Turing",
        eventName: "Workshop de Marketing",
        backupCode: "WXYZ5678",
        qrPngBase64: Buffer.from("fake-png").toString("base64"),
      }),
    );
    expect(result.success).toBe(true);
  });
});
