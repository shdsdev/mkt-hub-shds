import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  addAttendeeToRegistration: vi.fn(),
  getEvent: vi.fn(),
  notifyEventWebhook: vi.fn(),
  sendConfirmationEmail: vi.fn(),
  exportQrPng: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({
  addAttendeeToRegistration: mocks.addAttendeeToRegistration,
  getEvent: mocks.getEvent,
  notifyEventWebhook: mocks.notifyEventWebhook,
}));
vi.mock("@/modules/notifications", () => ({ sendConfirmationEmail: mocks.sendConfirmationEmail }));
vi.mock("@/modules/qr", () => ({ exportQrPng: mocks.exportQrPng }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { addCompanionAction } from "./actions";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  profile: { id: "admin-1", organizationId: "org-1", role: "ADMIN", status: "active" },
};

const REGISTRATION_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

function formData(fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("registrationId", REGISTRATION_ID);
  fd.set("eventId", EVENT_ID);
  fd.set("fullName", "Alan Turing");
  fd.set("email", "alan@example.com");
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("addCompanionAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true, notificationId: "n1" });
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, name: "Workshop" });
    mocks.notifyEventWebhook.mockResolvedValue(undefined);
  });

  it("rejects a non-admin without calling the service", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const result = await addCompanionAction({}, formData());

    expect(result.error).toBeTruthy();
    expect(mocks.addAttendeeToRegistration).not.toHaveBeenCalled();
  });

  it("rejects invalid input without calling the service", async () => {
    const result = await addCompanionAction({}, formData({ email: "not-an-email" }));

    expect(result.error).toBeTruthy();
    expect(mocks.addAttendeeToRegistration).not.toHaveBeenCalled();
  });

  it("adds the companion, sends a confirmation email, and revalidates when confirmed", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({
      ok: true,
      registrationStatus: "confirmed",
      attendee: {
        id: "att-2",
        organizationId: "org-1",
        email: "alan@example.com",
        fullName: "Alan Turing",
        passToken: "pass-token-2",
        backupCode: "WXYZ5678",
      },
    });
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, name: "Workshop" });

    const result = await addCompanionAction({}, formData());

    expect(mocks.addAttendeeToRegistration).toHaveBeenCalledWith({
      registrationId: REGISTRATION_ID,
      organizationId: "org-1",
      attendee: expect.objectContaining({ fullName: "Alan Turing", email: "alan@example.com" }),
    });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alan@example.com", eventName: "Workshop" }),
    );
    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(
      { id: EVENT_ID, name: "Workshop" },
      "registration.created",
      expect.objectContaining({ status: "confirmed" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/events/${EVENT_ID}/registrations`);
    expect(result).toEqual({ success: true });
  });

  it("does not send an email when the registration is waitlisted, but still notifies the webhook", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({
      ok: true,
      registrationStatus: "waitlisted",
      attendee: { id: "att-2", organizationId: "org-1", email: "alan@example.com", fullName: "Alan Turing", passToken: "t", backupCode: "b" },
    });

    const result = await addCompanionAction({}, formData());

    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(
      expect.anything(),
      "registration.created",
      expect.objectContaining({ status: "waitlisted" }),
    );
    expect(result).toEqual({ success: true });
  });

  it("surfaces an at_capacity failure as a friendly message", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({ ok: false, reason: "at_capacity" });

    const result = await addCompanionAction({}, formData());

    expect(result.error).toMatch(/capacidad/i);
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });
});
