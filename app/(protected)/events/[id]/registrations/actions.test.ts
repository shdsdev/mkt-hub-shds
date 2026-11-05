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
  deleteUnapprovedRegistration: vi.fn(),
  sendRegistrationDecisionEmail: vi.fn(),
  createInternalNotifications: vi.fn(),
  updateAttendee: vi.fn(),
  replaceCompanion: vi.fn(),
  transferPrimaryAttendee: vi.fn(),
  deactivateCompanion: vi.fn(),
  listEventEditorIds: vi.fn(),
  recordAudit: vi.fn(),
  captureOperationFailure: vi.fn(),
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
  deleteUnapprovedRegistration: mocks.deleteUnapprovedRegistration,
  updateAttendee: mocks.updateAttendee,
  replaceCompanion: mocks.replaceCompanion,
  transferPrimaryAttendee: mocks.transferPrimaryAttendee,
  deactivateCompanion: mocks.deactivateCompanion,
  listEventEditorIds: mocks.listEventEditorIds,
}));
vi.mock("@/modules/notifications", () => ({
  sendConfirmationEmail: mocks.sendConfirmationEmail,
  sendRegistrationDecisionEmail: mocks.sendRegistrationDecisionEmail,
  createInternalNotifications: mocks.createInternalNotifications,
  sendTelegramMessage: mocks.sendTelegramMessage,
  resolveTelegramChatId: mocks.resolveTelegramChatId,
  resolveTelegramMessageTemplate: mocks.resolveTelegramMessageTemplate,
  buildRegistrationTelegramMessage: vi.fn(() => ({ text: "", replyMarkup: { inline_keyboard: [] } })),
}));
vi.mock("@/modules/qr", () => ({ exportQrPng: mocks.exportQrPng }));
vi.mock("@/modules/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/modules/monitoring", () => ({ captureOperationFailure: mocks.captureOperationFailure }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_ORIGIN: "https://hub.example.com",
    TELEGRAM_BOT_TOKEN: "test-token",
  },
}));
vi.mock("@/lib/events/event-email-content", () => ({ resolveEventEmailContent: vi.fn() }));

import {
  addCompanionAction,
  deleteRegistrationAction,
  editAttendeeAction,
  replaceCompanionAction,
  transferPrimaryOwnershipAction,
  retryPrimaryTransferInvitationAction,
  retryReplacementInvitationAction,
  removeCompanionAction,
  resendInvitationAction,
  updateRegistrationReviewStatusAction,
} from "./actions";

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

    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "b", emailStatus: "pending_approval" } });
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
      reviewStatus: "approved",
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
    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "WXYZ5678", emailStatus: "sent" } });
  });

  it("does not send an email when the registration is waitlisted, but still notifies the webhook", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({ ok: true, registrationStatus: "waitlisted", attendee: { id: "att-2", organizationId: "org-1", email: "alan@example.com", fullName: "Alan Turing", passToken: "t", backupCode: "b" } });
    const result = await addCompanionAction({}, formData());
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(expect.anything(), "registration.created", expect.objectContaining({ status: "waitlisted" }));
    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "b", emailStatus: "pending_approval" } });
  });

  it("reports a failed confirmation when the approved companion email cannot be sent", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({
      ok: true,
      registrationStatus: "confirmed",
      reviewStatus: "approved",
      cancelToken: "cancel-token-1",
      attendee: { id: "att-2", organizationId: "org-1", email: "alan@example.com", fullName: "Alan Turing", passToken: "t", backupCode: "b" },
    });
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: false, reason: "provider_failure" });

    const result = await addCompanionAction({}, formData());

    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "b", emailStatus: "failed" } });
  });

  it("surfaces an at_capacity failure as a friendly message", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({ ok: false, reason: "at_capacity" });
    const result = await addCompanionAction({}, formData());
    expect(result.error).toMatch(/capacidad/i);
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("does not send a confirmation when the registration is confirmed but not approved", async () => {
    mocks.addAttendeeToRegistration.mockResolvedValue({
      ok: true,
      registrationStatus: "confirmed",
      reviewStatus: "new",
      cancelToken: "cancel-token-1",
      attendee: { id: "att-2", organizationId: "org-1", email: "alan@example.com", fullName: "Alan Turing", passToken: "t", backupCode: "b" },
    });

    const result = await addCompanionAction({}, formData());

    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, addedCompanion: { fullName: "Alan Turing", backupCode: "b", emailStatus: "pending_approval" } });
  });

  it("resends the invitation email for an existing attendee", async () => {
    mocks.listRegistrations.mockResolvedValue([{ cancelToken: "cancel-token-1", reviewStatus: "approved", attendees: [{ id: "33333333-3333-4333-8333-333333333333", organizationId: "org-1", fullName: "Alan Turing", email: "alan@example.com", passToken: "pass-token-2", backupCode: "WXYZ5678" }] }]);
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true, notificationId: "resend" });
    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));
    expect(result).toEqual({ success: "Invitación reenviada por correo." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", force: true, manageUrl: "https://hub.example.com/events/cancel/cancel-token-1" }));
  });
});

describe("resendInvitationAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, id: "reception-1", profile: { ...adminUser.profile, role: "RECEPTION" } });
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(false);
    mocks.listEventReceptionistIds.mockResolvedValue(["reception-1"]);
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, name: "Workshop" });
    mocks.listRegistrations.mockResolvedValue([{
      cancelToken: "cancel-token-1",
      reviewStatus: "approved",
      attendees: [{ id: "33333333-3333-4333-8333-333333333333", organizationId: "org-1", fullName: "Alan Turing", email: "alan@example.com", backupCode: "WXYZ5678" }],
    }]);
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true, notificationId: "resend" });
  });

  it("allows an admin to resend the invitation", async () => {
    mocks.isAdmin.mockReturnValue(true);
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ success: "Invitación reenviada por correo." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", force: true }));
  });

  it("allows an assigned receptionist to resend the invitation", async () => {
    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ success: "Invitación reenviada por correo." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", force: true }));
  });

  it("records the successful resend against the event", async () => {
    await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      eventId: EVENT_ID,
      action: "event_send",
      resourceType: "event_notification",
      after: expect.objectContaining({ recipient: "alan@example.com", result: "sent" }),
    }));
  });

  it("records a failed resend against the event", async () => {
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: false, reason: "provider_failure" });
    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ error: "No se pudo enviar el correo." });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      eventId: EVENT_ID,
      action: "event_send_failed",
      after: expect.objectContaining({ recipient: "alan@example.com", result: "failed" }),
    }));
  });

  it("rejects an unassigned receptionist from resending the invitation", async () => {
    mocks.listEventReceptionistIds.mockResolvedValue([]);
    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ error: "No tienes permiso para administrar registros." });
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("rejects an editor from resending the invitation", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, id: "editor-1", profile: { ...adminUser.profile, id: "editor-1", role: "EVENT_EDITOR" } });
    mocks.listEventEditorIds.mockResolvedValue(["editor-1"]);
    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ success: "Invitación reenviada por correo." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", force: true }));
  });

  it("rejects resending an invitation when the registration is not approved", async () => {
    mocks.listRegistrations.mockResolvedValue([{
      cancelToken: "cancel-token-1",
      reviewStatus: "new",
      attendees: [{ id: "33333333-3333-4333-8333-333333333333", organizationId: "org-1", fullName: "Alan Turing", email: "alan@example.com", backupCode: "WXYZ5678" }],
    }]);

    const result = await resendInvitationAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ error: "Solo puedes reenviar invitaciones de clientes aprobados." });
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
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

describe("deleteRegistrationAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
  });

  it("deletes directly for an admin without changing review status or sending notifications", async () => {
    mocks.deleteUnapprovedRegistration.mockResolvedValue({ ok: true, registrationId: REGISTRATION_ID, attendeeCount: 2 });
    const data = new FormData();
    data.set("registrationId", REGISTRATION_ID);
    data.set("eventId", EVENT_ID);

    await expect(deleteRegistrationAction({}, data)).resolves.toEqual({ success: "Registro eliminado. No se enviaron correos." });
    expect(mocks.deleteUnapprovedRegistration).toHaveBeenCalledWith({ registrationId: REGISTRATION_ID, eventId: EVENT_ID, organizationId: "org-1", actorId: adminUser.id });
    expect(mocks.updateRegistrationReviewStatus).not.toHaveBeenCalled();
    expect(mocks.sendRegistrationDecisionEmail).not.toHaveBeenCalled();
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.createInternalNotifications).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
    expect(mocks.notifyEventWebhook).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/events/${EVENT_ID}/registrations`);
  });

  it("rejects deletion of a protected registration", async () => {
    mocks.deleteUnapprovedRegistration.mockResolvedValue({ ok: false, reason: "protected" });
    const data = new FormData();
    data.set("registrationId", REGISTRATION_ID);
    data.set("eventId", EVENT_ID);

    await expect(deleteRegistrationAction({}, data)).resolves.toEqual({ error: "No se puede eliminar: el registro no es público, fue aprobado, tiene historial protegido o registra actividad en el evento." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.sendRegistrationDecisionEmail).not.toHaveBeenCalled();
  });

  it("returns not found without exposing registrations from another event or organization", async () => {
    mocks.deleteUnapprovedRegistration.mockResolvedValue({ ok: false, reason: "not_found" });
    await expect(deleteRegistrationAction({}, formData())).resolves.toEqual({ error: "No se encontró el registro." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["RECEPTION", "EVENT_EDITOR", "MARKETING_MANAGER", "VIEWER"])("rejects %s without invoking deletion", async (role) => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, profile: { ...adminUser.profile, role } });
    expect((await deleteRegistrationAction({}, formData())).error).toBeTruthy();
    expect(mocks.deleteUnapprovedRegistration).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and inactive users", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await deleteRegistrationAction({}, formData())).error).toBeTruthy();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(false);
    expect((await deleteRegistrationAction({}, formData())).error).toBeTruthy();
    expect(mocks.deleteUnapprovedRegistration).not.toHaveBeenCalled();
  });

  it("rejects malformed identifiers", async () => {
    expect((await deleteRegistrationAction({}, formData({ registrationId: "invalid" }))).error).toBeTruthy();
    expect((await deleteRegistrationAction({}, formData({ eventId: "invalid" }))).error).toBeTruthy();
    expect(mocks.deleteUnapprovedRegistration).not.toHaveBeenCalled();
  });

  it("returns a safe error when the transaction fails without sending messages or leaking query details", async () => {
    mocks.deleteUnapprovedRegistration.mockRejectedValue(new Error("private database query"));
    await expect(deleteRegistrationAction({}, formData())).resolves.toEqual({ error: "No se pudo completar la eliminación. Actualiza la lista antes de intentarlo de nuevo." });
    expect(mocks.captureOperationFailure).toHaveBeenCalledWith(expect.objectContaining({ operation: "registration_delete" }));
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.sendRegistrationDecisionEmail).not.toHaveBeenCalled();
  });
});

describe("attendee management actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.listEventEditorIds.mockResolvedValue([]);
    mocks.listRegistrations.mockResolvedValue([]);
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, organizationId: "org-1", name: "Workshop", registrationFormConfig: { fields: { phone: { visible: true, required: false } } } });
  });

  it("allows an assigned event editor to edit attendee data", async () => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, id: "editor-1", profile: { ...adminUser.profile, role: "EVENT_EDITOR" } });
    mocks.listEventEditorIds.mockResolvedValue(["editor-1"]);
    mocks.updateAttendee.mockResolvedValue({ ok: true, attendee: { id: "attendee-1", email: "new@example.com" }, previous: { fullName: "Alan Turing", email: "alan@example.com", phone: null, company: null, jobTitle: null, occupation: "architect-decorator" } });

    const result = await editAttendeeAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ success: "Datos del asistente actualizados.", emailResent: true });
    expect(mocks.updateAttendee).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", organizationId: "org-1" }));
  });

  it("rejects an editor who is not assigned to the event", async () => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, id: "editor-1", profile: { ...adminUser.profile, role: "EVENT_EDITOR" } });
    mocks.listEventEditorIds.mockResolvedValue(["another-editor"]);

    const result = await editAttendeeAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result.error).toBe("No tienes permiso para administrar asistentes.");
    expect(mocks.updateAttendee).not.toHaveBeenCalled();
  });

  it("allows an assigned event editor to transfer the primary identity", async () => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, id: "editor-1", profile: { ...adminUser.profile, role: "EVENT_EDITOR" } });
    mocks.listEventEditorIds.mockResolvedValue(["editor-1"]);
    mocks.listRegistrations.mockResolvedValue([{ id: REGISTRATION_ID, attendees: [{ id: "33333333-3333-4333-8333-333333333333", isPrimary: true }] }]);
    mocks.transferPrimaryAttendee.mockResolvedValue({
      ok: true,
      attendee: { id: "33333333-3333-4333-8333-333333333333", fullName: "New Primary", email: "new@example.com", backupCode: "NEW12345" },
      previous: { fullName: "Old Primary", email: "old@example.com" },
      registrationStatus: "pending_review",
      reviewStatus: "new",
      cancelToken: "cancel-token",
    });

    const result = await transferPrimaryOwnershipAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333", fullName: "New Primary", email: "new@example.com" }));

    expect(result).toEqual({ success: "Titularidad transferida. La invitación se enviará cuando el registro sea aprobado." });
    expect(mocks.transferPrimaryAttendee).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", organizationId: "org-1" }));
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "event_primary_transfer" }));
  });

  it("replaces a companion and records the operation", async () => {
    mocks.listRegistrations.mockResolvedValue([{ id: REGISTRATION_ID, reviewStatus: "new", attendees: [{ id: "33333333-3333-4333-8333-333333333333" }] }]);
    mocks.replaceCompanion.mockResolvedValue({ ok: true, attendee: { id: "attendee-2", fullName: "Ana", email: "ana@example.com", backupCode: "NEW12345" }, previous: { fullName: "Pedro", email: "pedro@example.com" } });

    const result = await replaceCompanionAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333", fullName: "Ana", email: "ana@example.com" }));

    expect(result).toEqual({ success: "Acompañante reemplazado." });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "event_attendee_replace", resourceType: "event_attendee" }));
  });

  it("deactivates an un checked-in companion", async () => {
    mocks.deactivateCompanion.mockResolvedValue({ ok: true, attendee: { id: "attendee-2" } });

    const result = await removeCompanionAction({}, formData({ attendeeId: "33333333-3333-4333-8333-333333333333" }));

    expect(result).toEqual({ success: "Acompañante eliminado." });
    expect(mocks.deactivateCompanion).toHaveBeenCalledWith(expect.objectContaining({ attendeeId: "33333333-3333-4333-8333-333333333333", organizationId: "org-1" }));
  });
});

describe("replacement invitation delivery", () => {
  const attendeeId = "33333333-3333-4333-8333-333333333333";
  const currentAttendee = { id: attendeeId, organizationId: "org-1", fullName: "Ana", email: "ana@example.com", backupCode: "CURRENT1", passToken: "current-token", isActive: true };
  const registration = { id: REGISTRATION_ID, eventId: EVENT_ID, status: "confirmed", reviewStatus: "approved", cancelToken: "current-cancel", attendees: [currentAttendee] };
  const data = () => formData({ attendeeId });

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, name: "Workshop", registrationFormConfig: { fields: { phone: { required: false } } } });
    mocks.listRegistrations.mockResolvedValue([registration]);
    mocks.replaceCompanion.mockResolvedValue({ ok: true, attendee: { ...currentAttendee, backupCode: "NEW12345" }, previous: { fullName: "Pedro", email: "pedro@example.com" }, registrationStatus: "confirmed", cancelToken: "current-cancel" });
    mocks.exportQrPng.mockImplementation(async (code: string) => Buffer.from(code));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true });
  });

  it("forces delivery for the approved replacement despite the reused attendee id", async () => {
    expect(await replaceCompanionAction({}, data())).toEqual({ success: "Acompañante reemplazado." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ attendeeId, force: true, to: "ana@example.com", backupCode: "NEW12345" }));
  });

  it("keeps a pending review pending and does not email even with confirmed registration status", async () => {
    mocks.listRegistrations.mockResolvedValue([{ ...registration, reviewStatus: "new" }]);
    expect(await replaceCompanionAction({}, data())).toHaveProperty("success");
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.updateRegistrationReviewStatus).not.toHaveBeenCalled();
  });

  it.each(["false", "throw"])("returns a completed replacement and retry identifiers on email %s", async (failure) => {
    if (failure === "throw") mocks.sendConfirmationEmail.mockRejectedValue(new Error("provider unavailable"));
    else mocks.sendConfirmationEmail.mockResolvedValue({ sent: false, reason: "provider_failure" });
    const result = await replaceCompanionAction({}, data());
    expect(result).toMatchObject({ success: "Acompañante reemplazado.", warning: expect.any(String), retry: { eventId: EVENT_ID, registrationId: REGISTRATION_ID, attendeeId } });
    expect(result.error).toBeUndefined();
    expect(mocks.replaceCompanion).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([replaceCompanionAction, retryReplacementInvitationAction])("rejects a target outside the requested event or registration", async (action) => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, profile: { ...adminUser.profile, role: "EVENT_EDITOR" } });
    mocks.listEventEditorIds.mockResolvedValue([adminUser.id]);
    mocks.listRegistrations.mockResolvedValue([{ ...registration, id: "another-registration" }]);
    expect(await action({}, data())).toHaveProperty("error");
    expect(mocks.replaceCompanion).not.toHaveBeenCalled();
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    mocks.listRegistrations.mockResolvedValue([]);
    expect(await action({}, data())).toHaveProperty("error");
  });

  it.each([replaceCompanionAction, retryReplacementInvitationAction])("rejects reception, unassigned editors and inactive users", async (action) => {
    mocks.isAdmin.mockReturnValue(false);
    for (const role of ["RECEPTION", "EVENT_EDITOR", "VIEWER"]) {
      mocks.getCurrentUser.mockResolvedValue({ ...adminUser, profile: { ...adminUser.profile, role } });
      mocks.listEventEditorIds.mockResolvedValue([]);
      expect(await action({}, data())).toHaveProperty("error");
    }
    mocks.isActive.mockReturnValue(false);
    expect(await action({}, data())).toHaveProperty("error");
    expect(mocks.replaceCompanion).not.toHaveBeenCalled();
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("allows an assigned editor to retry with current credentials without replacement", async () => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, profile: { ...adminUser.profile, role: "EVENT_EDITOR" } });
    mocks.listEventEditorIds.mockResolvedValue([adminUser.id]);
    expect(await retryReplacementInvitationAction({}, data())).toHaveProperty("success");
    expect(mocks.exportQrPng).toHaveBeenCalledWith("CURRENT1", {});
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ force: true, backupCode: "CURRENT1", to: "ana@example.com", manageUrl: "https://hub.example.com/events/cancel/current-cancel" }));
    expect(mocks.replaceCompanion).not.toHaveBeenCalled();
  });

  it.each([
    { reviewStatus: "new" }, { status: "cancelled" }, { status: "waitlisted" },
    { attendees: [{ ...currentAttendee, isActive: false }] }, { attendees: [] },
  ])("rejects retry when eligibility changed: %j", async (changes) => {
    mocks.listRegistrations.mockResolvedValue([{ ...registration, ...changes }]);
    expect(await retryReplacementInvitationAction({}, data())).toHaveProperty("error");
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.replaceCompanion).not.toHaveBeenCalled();
  });

  it.each(["false", "throw"])("surfaces retry email failure: %s", async (failure) => {
    if (failure === "throw") mocks.sendConfirmationEmail.mockRejectedValue(new Error("offline"));
    else mocks.sendConfirmationEmail.mockResolvedValue({ sent: false, reason: "provider_failure" });
    expect(await retryReplacementInvitationAction({}, data())).toHaveProperty("error");
    expect(mocks.replaceCompanion).not.toHaveBeenCalled();
  });
});

describe("primary transfer invitation delivery", () => {
  const attendeeId = "33333333-3333-4333-8333-333333333333";
  const registration = { id: REGISTRATION_ID, eventId: EVENT_ID, status: "confirmed", reviewStatus: "approved", cancelToken: "current-cancel", attendees: [{ id: attendeeId, isPrimary: true, isActive: true, organizationId: "org-1", fullName: "New Primary", email: "new@example.com", backupCode: "NEW12345" }] };
  const data = () => formData({ attendeeId, fullName: "New Primary", email: "new@example.com" });

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({ id: EVENT_ID, name: "Workshop", registrationFormConfig: { fields: { phone: { required: false } } } });
    mocks.listRegistrations.mockResolvedValue([registration]);
    mocks.transferPrimaryAttendee.mockResolvedValue({ ok: true, attendee: registration.attendees[0], previous: { fullName: "Old Primary", email: "old@example.com" }, registrationStatus: "confirmed", reviewStatus: "approved", cancelToken: "current-cancel" });
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true });
  });

  it("sends a forced invitation after an approved transfer", async () => {
    await expect(transferPrimaryOwnershipAction({}, data())).resolves.toEqual({ success: "Titularidad transferida. La invitación fue enviada a new@example.com." });
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ attendeeId, force: true, to: "new@example.com", backupCode: "NEW12345" }));
  });

  it("does not email a pending transfer", async () => {
    mocks.listRegistrations.mockResolvedValue([{ ...registration, reviewStatus: "new", status: "pending_review" }]);
    mocks.transferPrimaryAttendee.mockResolvedValue({ ok: true, attendee: registration.attendees[0], previous: { fullName: "Old Primary", email: "old@example.com" }, registrationStatus: "pending_review", reviewStatus: "new", cancelToken: "current-cancel" });
    await expect(transferPrimaryOwnershipAction({}, data())).resolves.toEqual({ success: "Titularidad transferida. La invitación se enviará cuando el registro sea aprobado." });
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("retries delivery without transferring again", async () => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.getCurrentUser.mockResolvedValue({ ...adminUser, id: "editor-1", profile: { ...adminUser.profile, role: "EVENT_EDITOR" } });
    mocks.listEventEditorIds.mockResolvedValue(["editor-1"]);
    await expect(retryPrimaryTransferInvitationAction({}, data())).resolves.toHaveProperty("success");
    expect(mocks.transferPrimaryAttendee).not.toHaveBeenCalled();
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ force: true, to: "new@example.com" }));
  });
});
