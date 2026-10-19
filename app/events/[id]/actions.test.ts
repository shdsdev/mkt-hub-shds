import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedEventBySlugPublic: vi.fn(),
  registerForEvent: vi.fn(),
  notifyEventWebhook: vi.fn(),
  listEventReceptionistIds: vi.fn(),
  listManagedUsers: vi.fn(),
  sendConfirmationEmail: vi.fn(),
  exportQrPng: vi.fn(),
  OCCUPATION_OPTIONS: ["wholesaler", "manufacturer", "architect-decorator", "installer-technician"],
  MEXICAN_STATES: [{ value: "jalisco", label: "Jalisco" }],
  resolveRegistrationFormConfig: vi.fn(() => ({
    version: 1,
    customFieldsVersion: 1,
    customFields: [],
    fields: {
      phone: { visible: false, required: false },
      company: { visible: true, required: false },
      jobTitle: { visible: false, required: false },
      state: { visible: false, required: false },
    },
    companion: { enabled: true },
    clientBrands: { enabled: true, options: ["shades", "bmighty", "drapery"] },
    interests: { enabled: false, options: [] },
    consent: {
      privacy: { url: "/privacy", text: "Acepto la política de privacidad" },
      terms: { url: "/terms", text: "Acepto los términos y condiciones" },
      marketing: { enabled: false, text: "Novedades" },
    },
  })),
}));

vi.mock("@/modules/events", () => ({
  getPublishedEventBySlugPublic: mocks.getPublishedEventBySlugPublic,
  registerForEvent: mocks.registerForEvent,
  notifyEventWebhook: mocks.notifyEventWebhook,
  listEventReceptionistIds: mocks.listEventReceptionistIds,
  OCCUPATION_OPTIONS: mocks.OCCUPATION_OPTIONS,
  MEXICAN_STATES: mocks.MEXICAN_STATES,
  resolveRegistrationFormConfig: mocks.resolveRegistrationFormConfig,
}));
vi.mock("@/modules/notifications", () => ({
  sendConfirmationEmail: mocks.sendConfirmationEmail,
  createInternalNotifications: vi.fn(),
  sendTelegramMessage: vi.fn(),
  buildRegistrationTelegramMessage: vi.fn(() => ({ text: "", replyMarkup: { inline_keyboard: [] } })),
}));
vi.mock("@/modules/users", () => ({ listManagedUsers: mocks.listManagedUsers }));
vi.mock("@/modules/qr", () => ({
  exportQrPng: mocks.exportQrPng,
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_ORIGIN: "https://hub.example.com", TELEGRAM_BOT_TOKEN: "test-token" },
}));

import { registerForEventAction } from "./actions";

const event = {
  id: "event-1",
  organizationId: "org-1",
  name: "Workshop de Marketing",
  slug: "workshop-marketing",
  status: "published" as const,
  startsAt: new Date("2026-11-06T15:00:00Z"),
  endsAt: new Date("2026-11-06T21:00:00Z"),
  location: "Hotel Victoria Ejecutivo Guadalajara",
};

function baseFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("slug", "workshop-marketing");
  fd.set("fullName", "Ada Lovelace");
  fd.set("email", "ada@example.com");
  fd.set("company", "Acme Interiors");
  fd.set("occupation", "architect-decorator");
  fd.set("privacyAccepted", "true");
  fd.set("termsAccepted", "true");
  for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
  return fd;
}

function requiredStateConfig() {
  const config = mocks.resolveRegistrationFormConfig();
  return { ...config, fields: { ...config.fields, state: { visible: true, required: true } } };
}

describe("registerForEventAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getPublishedEventBySlugPublic.mockResolvedValue(event);
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendConfirmationEmail.mockResolvedValue({ sent: true, notificationId: "n1" });
    mocks.notifyEventWebhook.mockResolvedValue(undefined);
    mocks.listEventReceptionistIds.mockResolvedValue([]);
    mocks.listManagedUsers.mockResolvedValue([]);
  });

  it("rejects when the event is no longer published", async () => {
    mocks.getPublishedEventBySlugPublic.mockResolvedValue(undefined);
    const result = await registerForEventAction({}, baseFormData());
    expect(result.error).toBeTruthy();
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid primary contact data without calling registerForEvent", async () => {
    const result = await registerForEventAction({}, baseFormData({ email: "not-an-email" }));
    expect(result.error).toBeTruthy();
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("ignores submissions that fill the honeypot field", async () => {
    const result = await registerForEventAction({}, baseFormData({ website: "https://spam.example" }));
    expect(result).toEqual({ success: true, status: "confirmed" });
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
    expect(mocks.notifyEventWebhook).not.toHaveBeenCalled();
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("registers the primary attendee and sends a confirmation email when confirmed", async () => {
    mocks.registerForEvent.mockResolvedValue({
      ok: true,
      registration: { status: "confirmed", cancelToken: "cancel-token-1" },
      attendees: [{ id: "att-1", organizationId: "org-1", email: "ada@example.com", fullName: "Ada Lovelace", passToken: "pass-token-1", backupCode: "ABCD1234" }],
    });
    const result = await registerForEventAction({}, baseFormData());
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: "event-1", source: "public", primary: expect.objectContaining({ fullName: "Ada Lovelace", email: "ada@example.com" }) }));
    expect(mocks.notifyEventWebhook).toHaveBeenCalledWith(event, "registration.created", expect.objectContaining({ status: "confirmed" }));
    expect(mocks.exportQrPng).toHaveBeenCalledWith("pass-token-1", {});
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", attendeeId: "att-1", to: "ada@example.com", attendeeName: "Ada Lovelace", eventName: "Workshop de Marketing", backupCode: "ABCD1234", qrPngBase64: Buffer.from("fake-png").toString("base64"), eventStartsAt: event.startsAt, eventEndsAt: event.endsAt, eventLocation: event.location, manageUrl: "https://hub.example.com/events/cancel/cancel-token-1" }));
    expect(result).toEqual({ success: true, status: "confirmed" });
  });

  it("does not send confirmation emails when the registration is waitlisted", async () => {
    mocks.registerForEvent.mockResolvedValue({ ok: true, registration: { status: "waitlisted" }, attendees: [{ id: "att-1", organizationId: "org-1", email: "ada@example.com", fullName: "Ada Lovelace", passToken: "pass-token-1", backupCode: "ABCD1234" }] });
    const result = await registerForEventAction({}, baseFormData());
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.exportQrPng).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, status: "waitlisted" });
  });

  it("shows a pending-review message without sending an access email", async () => {
    mocks.registerForEvent.mockResolvedValue({ ok: true, registration: { status: "pending_review" }, attendees: [] });

    const result = await registerForEventAction({}, baseFormData());

    expect(result).toEqual({ success: true, status: "pending_review" });
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("surfaces a duplicate-email registration as a friendly message", async () => {
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    const result = await registerForEventAction({}, baseFormData());
    expect(result.error).toMatch(/correo/i);
    expect(mocks.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("includes companions parsed from repeated form fields", async () => {
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionCompanyMode", "same");
    fd.append("companionOccupation", "architect-decorator");
    mocks.registerForEvent.mockResolvedValue({ ok: true, registration: { status: "confirmed", cancelToken: "cancel-token-1" }, attendees: [{ id: "att-1", organizationId: "org-1", email: "ada@example.com", fullName: "Ada Lovelace", passToken: "pass-token-1", backupCode: "ABCD1234" }, { id: "att-2", organizationId: "org-1", email: "alan@example.com", fullName: "Alan Turing", passToken: "pass-token-2", backupCode: "WXYZ5678" }] });
    await registerForEventAction({}, fd);
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ companions: [expect.objectContaining({ fullName: "Alan Turing", email: "alan@example.com" })] }));
    expect(mocks.sendConfirmationEmail).toHaveBeenCalledTimes(2);
  });

  it("copies the primary company when the companion selects same, ignoring a forged company", async () => {
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionCompanyMode", "same");
    fd.append("companionCompany", "Forged Industries");
    fd.append("companionOccupation", "architect-decorator");
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    await registerForEventAction({}, fd);
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ companions: [expect.objectContaining({ company: "Acme Interiors" })] }));
  });

  it("does not require or store companion company when company is hidden", async () => {
    mocks.resolveRegistrationFormConfig.mockReturnValue({ ...mocks.resolveRegistrationFormConfig(), fields: { ...mocks.resolveRegistrationFormConfig().fields, company: { visible: false, required: false } } });
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionOccupation", "architect-decorator");
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    await registerForEventAction({}, fd);
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ primary: expect.objectContaining({ company: undefined }), companions: [expect.objectContaining({ company: undefined })] }));
  });

  it("applies the inherited company before validating a required companion field", async () => {
    mocks.resolveRegistrationFormConfig.mockReturnValue({ ...mocks.resolveRegistrationFormConfig(), fields: { ...mocks.resolveRegistrationFormConfig().fields, company: { visible: true, required: true } } });
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionCompanyMode", "same");
    fd.append("companionOccupation", "architect-decorator");
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    await registerForEventAction({}, fd);
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ companions: [expect.objectContaining({ company: "Acme Interiors" })] }));
  });

  it("rejects same mode when the primary company is empty", async () => {
    const fd = baseFormData({ company: "" });
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionCompanyMode", "same");
    fd.append("companionOccupation", "architect-decorator");
    const result = await registerForEventAction({}, fd);
    expect(result).toEqual({ error: "Revisa la empresa del acompañante." });
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("stores a trimmed alternate company when the companion selects other", async () => {
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionCompanyMode", "other");
    fd.append("companionCompany", "  Turing Labs  ");
    fd.append("companionOccupation", "architect-decorator");
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    await registerForEventAction({}, fd);
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ companions: [expect.objectContaining({ company: "Turing Labs" })] }));
  });

  it("allows an alternate companion company when the primary company is optional", async () => {
    const fd = baseFormData({ company: "" });
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionCompanyMode", "other");
    fd.append("companionCompany", "Turing Labs");
    fd.append("companionOccupation", "architect-decorator");
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    await registerForEventAction({}, fd);
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ primary: expect.objectContaining({ company: undefined }), companions: [expect.objectContaining({ company: "Turing Labs" })] }));
  });

  it("still rejects a missing primary company when the field is required", async () => {
    mocks.resolveRegistrationFormConfig.mockReturnValue({ ...mocks.resolveRegistrationFormConfig(), fields: { ...mocks.resolveRegistrationFormConfig().fields, company: { visible: true, required: true } } });
    const result = await registerForEventAction({}, baseFormData({ company: "" }));
    expect(result).toEqual({ error: "La empresa es obligatorio." });
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects an empty alternate company without calling the service", async () => {
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionCompanyMode", "other");
    fd.append("companionCompany", "   ");
    fd.append("companionOccupation", "architect-decorator");
    const result = await registerForEventAction({}, fd);
    expect(result).toEqual({ error: "Revisa la empresa del acompañante." });
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it.each([["missing", undefined], ["invalid", "unsupported"]])("rejects a %s companion company mode", async (_label, mode) => {
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    if (mode) fd.append("companionCompanyMode", mode);
    fd.append("companionOccupation", "architect-decorator");
    const result = await registerForEventAction({}, fd);
    expect(result).toEqual({ error: "Revisa la empresa del acompañante." });
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects more than one companion", async () => {
    const fd = baseFormData();
    fd.append("companionFullName", "Alan Turing");
    fd.append("companionEmail", "alan@example.com");
    fd.append("companionOccupation", "architect-decorator");
    fd.append("companionOccupation", "architect-decorator");
    fd.append("companionFullName", "Grace Hopper");
    fd.append("companionEmail", "grace@example.com");
    fd.append("companionOccupation", "manufacturer");
    const result = await registerForEventAction({}, fd);
    expect(result.error).toBe("Solo puedes registrar un acompañante.");
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects missing required consent", async () => {
    const fd = baseFormData();
    fd.delete("privacyAccepted");
    const result = await registerForEventAction({}, fd);
    expect(result.error).toContain("política de privacidad");
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects an option that is disabled for the event", async () => {
    const result = await registerForEventAction({}, baseFormData({ interests: "curtains" }));
    expect(result.error).toBe("Revisa tus intereses seleccionados.");
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects a missing primary occupation", async () => {
    const fd = baseFormData();
    fd.delete("occupation");
    const result = await registerForEventAction({}, fd);
    expect(result.error).toContain("actividad profesional");
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects none combined with another brand", async () => {
    const fd = baseFormData();
    fd.append("clientBrands", "none");
    fd.append("clientBrands", "shades");
    const result = await registerForEventAction({}, fd);
    expect(result.error).toBe("Seleccioná una sola opción: Ninguno o una marca.");
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("accepts an explicit none selection even when no admin brand is configured as none", async () => {
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    const fd = baseFormData();
    fd.append("clientBrands", "none");
    const result = await registerForEventAction({}, fd);
    expect(result.error).toContain("Ya existe un registro");
    expect(mocks.registerForEvent).toHaveBeenCalled();
  });

  it("rejects a missing state when the public field is required", async () => {
    mocks.resolveRegistrationFormConfig.mockReturnValue(requiredStateConfig());
    const result = await registerForEventAction({}, baseFormData());
    expect(result).toEqual({ error: "El estado es obligatorio." });
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("rejects an unknown public state value", async () => {
    mocks.resolveRegistrationFormConfig.mockReturnValue(requiredStateConfig());
    const result = await registerForEventAction({}, baseFormData({ state: "not-a-state" }));
    expect(result).toEqual({ error: "Revisa tus datos de contacto.", fieldErrors: { state: "Seleccioná un estado válido." } });
    expect(mocks.registerForEvent).not.toHaveBeenCalled();
  });

  it("passes a valid public state to the registration service", async () => {
    mocks.resolveRegistrationFormConfig.mockReturnValue(requiredStateConfig());
    mocks.registerForEvent.mockResolvedValue({ ok: false, reason: "duplicate_email" });
    await registerForEventAction({}, baseFormData({ state: "jalisco" }));
    expect(mocks.registerForEvent).toHaveBeenCalledWith(expect.objectContaining({ primary: expect.objectContaining({ state: "jalisco" }) }));
  });
});
