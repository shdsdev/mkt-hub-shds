import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  addAttendeeToRegistration: vi.fn(),
  getEvent: vi.fn(),
  resolveRegistrationFormConfig: vi.fn((event) => event.registrationFormConfig),
  listRegistrations: vi.fn(),
  listEventReceptionistIds: vi.fn(),
  listManagedUsers: vi.fn(),
  notifyEventWebhook: vi.fn(),
  sendConfirmationEmail: vi.fn(),
  resolveTelegramChatId: vi.fn(),
  resolveTelegramMessageTemplate: vi.fn(),
  sendTelegramMessage: vi.fn(),
  exportQrPng: vi.fn(),
  updateRegistrationReviewStatus: vi.fn(),
  deleteRejectedRegistration: vi.fn(),
  revalidatePath: vi.fn(),
  OCCUPATION_OPTIONS: ["wholesaler", "manufacturer", "architect-decorator", "installer-technician"],
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin, listManagedUsers: mocks.listManagedUsers }));
vi.mock("@/modules/events", () => ({
  addAttendeeToRegistration: mocks.addAttendeeToRegistration,
  getEvent: mocks.getEvent,
  listRegistrations: mocks.listRegistrations,
  listEventReceptionistIds: mocks.listEventReceptionistIds,
  notifyEventWebhook: mocks.notifyEventWebhook,
  OCCUPATION_OPTIONS: mocks.OCCUPATION_OPTIONS,
  resolveRegistrationFormConfig: mocks.resolveRegistrationFormConfig,
  updateRegistrationReviewStatus: mocks.updateRegistrationReviewStatus,
  deleteRejectedRegistration: mocks.deleteRejectedRegistration,
}));
vi.mock("@/modules/notifications", () => ({
  sendConfirmationEmail: mocks.sendConfirmationEmail,
  sendRegistrationDecisionEmail: vi.fn(),
  createInternalNotifications: vi.fn(),
  sendTelegramMessage: mocks.sendTelegramMessage,
  resolveTelegramChatId: mocks.resolveTelegramChatId,
  resolveTelegramMessageTemplate: mocks.resolveTelegramMessageTemplate,
  buildRegistrationTelegramMessage: vi.fn(() => ({ text: "", replyMarkup: { inline_keyboard: [] } })),
}));
vi.mock("@/modules/qr", () => ({ exportQrPng: mocks.exportQrPng }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_ORIGIN: "https://hub.example.com",
    TELEGRAM_BOT_TOKEN: "test-token",
  },
}));
vi.mock("@/lib/events/event-email-content", () => ({ resolveEventEmailContent: vi.fn() }));

import { addCompanionAction, deleteRejectedRegistrationAction, resendInvitationAction, updateRegistrationReviewStatusAction } from "./actions";

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
  fd.set("phone", "+52 33 1234 5678");
  fd.set("occupation", "architect-decorator");
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
      collectCompany: true,
      collectJobTitle: false,
      registrationFormConfig: { version: 1, fields: { phone: { visible: true, required: true }, company: { visible: true, required: false }, jobTitle: { visible: false, required: false }, state: { visible: false, required: false } }, companion: { enabled: true }, clientBrands: { enabled: false, options: [] }, interests: { enabled: false, options: [] }, consent: { privacy: { url: "/privacy", text: "Privacidad" }, terms: { url: "/terms", text: "Términos" }, marketing: { enabled: false, text: "Marketing" } }, customFields: [], customFieldsVersion: 1 },
    });
    mocks.notifyEventWebhook.mockResolvedValue(undefined);
  });

  it("rejects a non-admin without calling the service", async () => {
    mocks.isAdmin.mockReturnValue(false);
    const result = await addCompanionAction({}, formData());
    expect(result.error).toBeTruthy();
    expect(mocks.addAttendeeToRegistration).not.toHaveBeenCalled();
  });

  it("allows an assigned receptionist to add a companion", async () => {
    const receptionist = { ...adminUser, id: "reception-1", profile: { ...adminUser.profile, role: "RECEPTION" } };
    mocks.getCurrentUser.mockResolvedValue(receptionist);
    mocks.isAdmin.mockReturnValue(false);
    mocks.listEventReceptionistIds.mockResolvedValue([receptionist.id]);
    mocks.addAttendeeToRegistration.mockResolvedValue({
      ok: true,
      registrationStatus: "waitlisted",
      attendee: { id: "att-2", organizationId: "org-1", email: "alan@example.com", fullName: "Alan Turing", passToken: "t", backupCode: "b" },
    });

    const result = await addCompanionAction({}, formData());

    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "b" } });
    expect(mocks.addAttendeeToRegistration).toHaveBeenCalled();
  });

  it("rejects a receptionist who is not assigned to the event", async () => {
    const receptionist = { ...adminUser, id: "reception-1", profile: { ...adminUser.profile, role: "RECEPTION" } };
    mocks.getCurrentUser.mockResolvedValue(receptionist);
    mocks.isAdmin.mockReturnValue(false);
    mocks.listEventReceptionistIds.mockResolvedValue(["another-receptionist"]);

    const result = await addCompanionAction({}, formData());

    expect(result.error).toBeTruthy();
    expect(mocks.addAttendeeToRegistration).not.toHaveBeenCalled();
  });

  it("rejects invalid input without calling the service", async () => {
    const result = await addCompanionAction({}, formData({ email: "not-an-email" }));
    expect(result.error).toBeTruthy();
    expect(mocks.addAttendeeToRegistration).not.toHaveBeenCalled();
  });

  it("rejects an empty phone when the event requires it", async () => {
    const result = await addCompanionAction({}, formData({ phone: "   " }));
    expect(result.error).toBe("El teléfono es obligatorio.");
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

    const result = await addCompanionAction({}, formData());
    expect(mocks.addAttendeeToRegistration).toHaveBeenCalledWith({
      registrationId: REGISTRATION_ID,
      organizationId: "org-1",
      ignoreCapacity: true,
      attendee: expect.objectContaining({ fullName: "Alan Turing", email: "alan@example.com" }),
    });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "alan@example.com",
      eventName: "Workshop",
      eventStartsAt: new Date("2026-11-06T15:00:00Z"),
      eventEndsAt: new Date("2026-11-06T21:00:00Z"),
      eventLocation: "Hotel Victoria Ejecutivo Guadalajara",
      manageUrl: "https://hub.example.com/events/cancel/cancel-token-1",
    }));
    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(expect.objectContaining({ id: EVENT_ID, name: "Workshop" }), "registration.created", expect.objectContaining({ status: "confirmed" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/events/${EVENT_ID}/registrations`);
    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "WXYZ5678" } });
  });

  it("does not send an email when the registration is waitlisted, but still notifies the webhook", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({ ok: true, registrationStatus: "waitlisted", attendee: { id: "att-2", organizationId: "org-1", email: "alan@example.com", fullName: "Alan Turing", passToken: "t", backupCode: "b" } });
    const result = await addCompanionAction({}, formData());
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(expect.anything(), "registration.created", expect.objectContaining({ status: "waitlisted" }));
    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "b" } });
  });

  it("surfaces an at_capacity failure as a friendly message", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({ ok: false, reason: "at_capacity" });
    const result = await addCompanionAction({}, formData());
    expect(result.error).toMatch(/capacidad/i);
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("resends the invitation email for an existing attendee", async () => {
    mocks.listRegistrations.mockResolvedValue([{ cancelToken: "cancel-token-1", attendees: [{ id: "33333333-3333-4333-8333-333333333333", organizationId: "org-1", fullName: "Alan Turing", email: "alan@example.com", passToken: "pass-token-2", backupCode: "WXYZ5678" }] }]);
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true, notificationId: "resend" });
    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));
    expect(result).toEqual({ success: "Invitación reenviada por correo." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", force: true, manageUrl: "https://hub.example.com/events/cancel/cancel-token-1" }));
  });
});

describe("updateRegistrationReviewStatusAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, id: "11111111-1111-4111-8111-111111111111" });
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.resolveTelegramChatId.mockResolvedValue(undefined);
    mocks.resolveTelegramMessageTemplate.mockResolvedValue(undefined);
    mocks.listEventReceptionistIds.mockResolvedValue([]);
    mocks.listRegistrations.mockResolvedValue([]);
    mocks.listManagedUsers.mockResolvedValue([]);
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, organizationId: "org-1", name: "Workshop", startsAt: new Date("2026-11-06T15:00:00Z"), endsAt: new Date("2026-11-06T21:00:00Z"), location: null, locationUrl: null, agenda: [], emailContent: null, telegramChatId: null });
    mocks.updateRegistrationReviewStatus.mockResolvedValue({ id: "registration-1" });
  });

  it("updates review status within the current organization", async () => {
    const data = new FormData();
    data.set("registrationId", "22222222-2222-4222-8222-222222222222");
    data.set("eventId", "33333333-3333-4333-8333-333333333333");
    data.set("reviewStatus", "approved");
    const result = await updateRegistrationReviewStatusAction({}, data);
    expect(result).toEqual({ success: "Estado de revisión actualizado." });
    expect(mocks.updateRegistrationReviewStatus).toHaveBeenCalledWith(expect.objectContaining({ reviewStatus: "approved", organizationId: "org-1" }));
  });

  it("sends confirmation emails to the primary attendee and active companions after approval", async () => {
    mocks.listRegistrations.mockResolvedValue([{
      id: REGISTRATION_ID,
      cancelToken: "cancel-token",
      attendees: [
        { id: "attendee-primary", organizationId: "org-1", fullName: "Ada Lovelace", email: "ada@example.com", backupCode: "ADA12345", isActive: true },
        { id: "attendee-companion", organizationId: "org-1", fullName: "Grace Hopper", email: "grace@example.com", backupCode: "GRACE678", isActive: true },
        { id: "attendee-inactive", organizationId: "org-1", fullName: "Inactive Person", email: "inactive@example.com", backupCode: "INACTIVE", isActive: false },
      ],
    }]);
    mocks.exportQrPng.mockImplementation(async (backupCode: string) => Buffer.from(backupCode));
    const data = new FormData();
    data.set("registrationId", REGISTRATION_ID);
    data.set("eventId", EVENT_ID);
    data.set("reviewStatus", "approved");

    await expect(updateRegistrationReviewStatusAction({}, data)).resolves.toEqual({ success: "Estado de revisión actualizado." });

    expect(mocks.sendConfirmationEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendConfirmationEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({
      attendeeId: "attendee-primary",
      to: "ada@example.com",
      attendeeName: "Ada Lovelace",
      backupCode: "ADA12345",
      qrPngBase64: Buffer.from("ADA12345").toString("base64"),
    }));
    expect(mocks.sendConfirmationEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({
      attendeeId: "attendee-companion",
      to: "grace@example.com",
      attendeeName: "Grace Hopper",
      backupCode: "GRACE678",
      qrPngBase64: Buffer.from("GRACE678").toString("base64"),
    }));
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "attendee-inactive" }));
  });

  it("accepts the waitlisted commercial decision", async () => {
    const data = new FormData();
    data.set("registrationId", "22222222-2222-4222-8222-222222222222");
    data.set("eventId", "33333333-3333-4333-8333-333333333333");
    data.set("reviewStatus", "waitlisted");

    const result = await updateRegistrationReviewStatusAction({}, data);

    expect(result).toEqual({ success: "Estado de revisión actualizado." });
  });

  it("does not send Telegram when a review decision changes", async () => {
    mocks.resolveTelegramChatId.mockResolvedValue("-100123");
    mocks.listRegistrations.mockResolvedValue([{
      id: "22222222-2222-4222-8222-222222222222",
      cancelToken: "cancel-token",
      attendees: [{
        id: "attendee-1",
        organizationId: "org-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        phone: null,
        company: null,
        jobTitle: null,
        occupation: "manufacturer",
        state: "jalisco",
        passToken: "pass-token",
        backupCode: "ABCD1234",
      }],
    }]);
    const data = new FormData();
    data.set("registrationId", "22222222-2222-4222-8222-222222222222");
    data.set("eventId", "33333333-3333-4333-8333-333333333333");
    data.set("reviewStatus", "rejected");

    await expect(updateRegistrationReviewStatusAction({}, data)).resolves.toEqual({ success: "Estado de revisión actualizado." });
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("rejects non-admin users without changing the registration", async () => {
    mocks.isAdmin.mockReturnValue(false);
    const result = await updateRegistrationReviewStatusAction({}, new FormData());
    expect(result).toEqual({ error: "No tienes permiso para administrar registros." });
    expect(mocks.updateRegistrationReviewStatus).not.toHaveBeenCalled();
  });
});

describe("deleteRejectedRegistrationAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
  });

  it("deletes an organization-scoped rejected registration for an admin", async () => {
    mocks.deleteRejectedRegistration.mockResolvedValue({ id: REGISTRATION_ID, status: "rejected" });
    const data = new FormData();
    data.set("registrationId", REGISTRATION_ID);
    data.set("eventId", EVENT_ID);

    await expect(deleteRejectedRegistrationAction({}, data)).resolves.toEqual({ success: "Registro eliminado." });
    expect(mocks.deleteRejectedRegistration).toHaveBeenCalledWith({ registrationId: REGISTRATION_ID, eventId: EVENT_ID, organizationId: "org-1" });
  });

  it("rejects deletion when the registration is not rejected or missing", async () => {
    mocks.deleteRejectedRegistration.mockResolvedValue(undefined);
    const data = new FormData();
    data.set("registrationId", REGISTRATION_ID);
    data.set("eventId", EVENT_ID);

    await expect(deleteRejectedRegistrationAction({}, data)).resolves.toEqual({ error: "Solo se pueden eliminar registros rechazados." });
  });
});
