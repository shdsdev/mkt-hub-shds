import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  checkInAttendee: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));
vi.mock("@/modules/events", () => ({ checkInAttendee: mocks.checkInAttendee }));

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
});
