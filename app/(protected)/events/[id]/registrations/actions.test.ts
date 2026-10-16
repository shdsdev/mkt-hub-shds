import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  addAttendeeToRegistration: vi.fn(),
  getEvent: vi.fn(),
  listRegistrations: vi.fn(),
  notifyEventWebhook: vi.fn(),
  sendConfirmationEmail: vi.fn(),
  exportQrPng: vi.fn(),
  revalidatePath: vi.fn(),
  OCCUPATION_OPTIONS: ["distributor", "manufacturer", "architect", "decorator", "installer-technician"],
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({
  addAttendeeToRegistration: mocks.addAttendeeToRegistration,
  getEvent: mocks.getEvent,
  listRegistrations: mocks.listRegistrations,
  notifyEventWebhook: mocks.notifyEventWebhook,
  OCCUPATION_OPTIONS: mocks.OCCUPATION_OPTIONS,
}));
vi.mock("@/modules/notifications", () => ({ sendConfirmationEmail: mocks.sendConfirmationEmail }));
vi.mock("@/modules/qr", () => ({ exportQrPng: mocks.exportQrPng }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_ORIGIN: "https://hub.example.com" } }));

import { addCompanionAction, resendInvitationAction } from "./actions";

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
  fd.set("occupation", "architect");
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
    mocks.getEvent.mockResolvedValue({
      id: EVENT_ID,
      name: "Workshop",
      startsAt: new Date("2026-11-06T15:00:00Z"),
      endsAt: new Date("2026-11-06T21:00:00Z"),
      location: "Hotel Victoria Ejecutivo Guadalajara",
    });
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
      cancelToken: "cancel-token-1",
      attendee: {
        id: "33333333-3333-4333-8333-333333333333",
        organizationId: "org-1",
        email: "alan@example.com",
        fullName: "Alan Turing",
        passToken: "pass-token-2",
        backupCode: "WXYZ5678",
      },
    });
    mocks.getEvent.mockResolvedValue({
      id: EVENT_ID,
      name: "Workshop",
      startsAt: new Date("2026-11-06T15:00:00Z"),
      endsAt: new Date("2026-11-06T21:00:00Z"),
      location: "Hotel Victoria Ejecutivo Guadalajara",
    });

    const result = await addCompanionAction({}, formData());

    expect(mocks.addAttendeeToRegistration).toHaveBeenCalledWith({
      registrationId: REGISTRATION_ID,
      organizationId: "org-1",
      ignoreCapacity: true,
      attendee: expect.objectContaining({ fullName: "Alan Turing", email: "alan@example.com" }),
    });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alan@example.com",
        eventName: "Workshop",
        eventStartsAt: new Date("2026-11-06T15:00:00Z"),
        eventEndsAt: new Date("2026-11-06T21:00:00Z"),
        eventLocation: "Hotel Victoria Ejecutivo Guadalajara",
        manageUrl: "https://hub.example.com/events/cancel/cancel-token-1",
      }),
    );
    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ id: EVENT_ID, name: "Workshop" }),
      "registration.created",
      expect.objectContaining({ status: "confirmed" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/events/${EVENT_ID}/registrations`);
    expect(result).toEqual({
      success: true,
      addedCompanion: { fullName: "Alan Turing", backupCode: "WXYZ5678" },
    });
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
    expect(result).toEqual({
      success: true,
      addedCompanion: { fullName: "Alan Turing", backupCode: "b" },
    });
  });

  it("surfaces an at_capacity failure as a friendly message", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({ ok: false, reason: "at_capacity" });

    const result = await addCompanionAction({}, formData());

    expect(result.error).toMatch(/capacidad/i);
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("resends the invitation email for an existing attendee", async () => {
    mocks.listRegistrations.mockResolvedValue([{
      cancelToken: "cancel-token-1",
      attendees: [{
        id: "33333333-3333-4333-8333-333333333333",
        organizationId: "org-1",
        fullName: "Alan Turing",
        email: "alan@example.com",
        passToken: "pass-token-2",
        backupCode: "WXYZ5678",
      }],
    }]);
    mocks.getEvent.mockResolvedValue({
      id: EVENT_ID,
      name: "Workshop",
      startsAt: new Date("2026-11-06T15:00:00Z"),
      endsAt: new Date("2026-11-06T21:00:00Z"),
      location: "Hotel Victoria Ejecutivo Guadalajara",
    });
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true, notificationId: "resend" });

    const fd = formData({ attendeeId: "33333333-3333-4333-8333-333333333333" });
    const result = await resendInvitationAction({}, fd);

    expect(result).toEqual({ success: "Invitación reenviada por correo." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({
      attendeeId: "33333333-3333-4333-8333-333333333333",
      force: true,
      manageUrl: "https://hub.example.com/events/cancel/cancel-token-1",
    }));
  });
});
