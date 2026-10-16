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
}));

import { checkInAction } from "./actions";

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
});
