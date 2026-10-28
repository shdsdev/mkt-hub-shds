import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  createEvent: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  setEventStatus: vi.fn(),
  archiveEvent: vi.fn(),
  restoreEvent: vi.fn(),
  deleteEvent: vi.fn(),
  setEventWebhookUrl: vi.fn(),
  regenerateEventWebhookSecret: vi.fn(),
  registrationFormConfigSchema: {
    _parse(input: { data: unknown }) {
      return { status: "valid", value: input.data };
    },
  },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({
  createEvent: mocks.createEvent,
  getEvent: mocks.getEvent,
  updateEvent: mocks.updateEvent,
  setEventStatus: mocks.setEventStatus,
  archiveEvent: mocks.archiveEvent,
  restoreEvent: mocks.restoreEvent,
  deleteEvent: mocks.deleteEvent,
  setEventWebhookUrl: mocks.setEventWebhookUrl,
  regenerateEventWebhookSecret: mocks.regenerateEventWebhookSecret,
  registrationFormConfigSchema: mocks.registrationFormConfigSchema,
}));
vi.mock("@/modules/notifications", () => ({ validateTelegramTemplate: vi.fn(() => undefined) }));
vi.mock("@/modules/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createEventAction,
  updateEventAction,
  saveEventTelegramChatIdAction,
  saveEventTelegramMessageTemplateAction,
  publishEventAction,
  closeEventAction,
  archiveEventAction,
  restoreEventAction,
  deleteEventAction,
  setWebhookAction,
  regenerateWebhookSecretAction,
} from "./actions";

const adminUser = {
  id: "actor-1",
  email: "admin@example.com",
  profile: { id: "actor-1", organizationId: "org-1", role: "ADMIN", status: "active" },
};

function createFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const validCreateFields = {
  name: "Launch Day",
  slug: "launch-day",
  startsAt: "2026-11-01T18:00",
};

describe("events admin actions — isAdmin guard (tasks.md 2.3)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Original name",
      capacity: null,
      checkInConfirmationRequired: false,
      collectCompany: false,
      collectJobTitle: false,
      agenda: [],
      sponsorLogos: [],
      telegramChatId: null,
      telegramMessageTemplate: null,
    });
  });

  it("rejects event creation for a non-admin without calling the service", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const result = await createEventAction({}, createFormData(validCreateFields));

    expect(result).toEqual({ error: "No tienes permiso para administrar eventos." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects event edits for a non-admin without calling the service", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const result = await updateEventAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111", name: "Renamed" }),
    );

    expect(result).toEqual({ error: "No tienes permiso para administrar eventos." });
    expect(mocks.updateEvent).not.toHaveBeenCalled();
  });

  it("saves only the event Telegram chat ID", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "11111111-1111-4111-8111-111111111111" } });

    const result = await saveEventTelegramChatIdAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111", telegramChatId: "-1004365089226" }),
    );

    expect(result).toEqual({ success: "Grupo de Telegram guardado." });
    expect(mocks.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      id: "11111111-1111-4111-8111-111111111111",
      changes: { telegramChatId: "-1004365089226" },
    }));
  });

  it("saves an event-specific Telegram message template", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "11111111-1111-4111-8111-111111111111" } });

    const result = await saveEventTelegramMessageTemplateAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        template: "{{nombre}} solicitó acceso a {{evento}}.",
      }),
    );

    expect(result).toEqual({ success: "Mensaje de Telegram guardado." });
    expect(mocks.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      changes: { telegramMessageTemplate: "{{nombre}} solicitó acceso a {{evento}}." },
    }));
  });

  it("records only the fields that actually changed", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "11111111-1111-4111-8111-111111111111" } });

    await updateEventAction({}, createFormData({ id: "11111111-1111-4111-8111-111111111111", name: "Renamed" }));

    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "11111111-1111-4111-8111-111111111111",
      action: "event_change",
      resourceType: "event",
      before: { name: "Original name" },
      after: { name: "Renamed" },
    }));
  });

  it("skips the audit entry when nothing changed", async () => {
    const result = await updateEventAction({}, createFormData({ id: "11111111-1111-4111-8111-111111111111", name: "Original name" }));

    expect(result).toEqual({ success: "Sin cambios." });
    expect(mocks.updateEvent).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("does not store the Telegram template body in the event history", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "11111111-1111-4111-8111-111111111111" } });

    await saveEventTelegramMessageTemplateAction({}, createFormData({ id: "11111111-1111-4111-8111-111111111111", template: "{{nombre}} secreto" }));

    const auditPayload = JSON.stringify(mocks.recordAudit.mock.calls[0]?.[0]);
    expect(auditPayload).not.toContain("secreto");
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      after: { telegramMessageTemplate: "Personalizado" },
    }));
  });

  it("rejects publish for a non-admin without calling the service", async () => {
    mocks.isAdmin.mockReturnValue(false);

    await publishEventAction(createFormData({ id: "11111111-1111-4111-8111-111111111111" }));

    expect(mocks.setEventStatus).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects close for a disabled admin without calling the service", async () => {
    mocks.isActive.mockReturnValue(false);

    await closeEventAction(createFormData({ id: "11111111-1111-4111-8111-111111111111" }));

    expect(mocks.setEventStatus).not.toHaveBeenCalled();
  });

  it("creates an event for an active ADMIN and revalidates the list", async () => {
    mocks.createEvent.mockResolvedValue({
      ok: true,
      event: { id: "event-1", name: "Launch Day" },
    });

    await createEventAction({}, createFormData(validCreateFields));
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorRole: "ADMIN",
        name: "Launch Day",
        slug: "launch-day",
        reminderOffsetMinutes: 2880,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/events");
    expect(mocks.redirect).toHaveBeenCalledWith("/events/event-1/dashboard");
  });

  it("passes a valid direct Maps URL and the 48-hour reminder when creating", async () => {
    mocks.createEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await createEventAction({}, createFormData({
      ...validCreateFields,
      location: "Hotel Victoria",
      locationUrl: "https://maps.google.com/?q=hotel",
    }));

    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      location: "Hotel Victoria",
      locationUrl: "https://maps.google.com/?q=hotel",
      reminderOffsetMinutes: 2880,
    }));
  });

  it("rejects an invalid direct Maps URL", async () => {
    const result = await createEventAction({}, createFormData({
      ...validCreateFields,
      locationUrl: "not-a-url",
    }));

    expect(result).toEqual({ error: "Revisa los datos del evento." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) (
    "rejects an unsafe direct Maps URL scheme: %s",
    async (locationUrl) => {
      const result = await createEventAction({}, createFormData({
        ...validCreateFields,
        locationUrl,
      }));

      expect(result).toEqual({ error: "Revisa los datos del evento." });
      expect(mocks.createEvent).not.toHaveBeenCalled();
    },
  );

  it("passes combined start and populated end timestamps to createEvent", async () => {
    mocks.createEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await createEventAction(
      {},
      createFormData({
        ...validCreateFields,
        startsAt: "2026-11-01T18:00",
        endsAt: "2026-11-01T20:30",
      }),
    );

    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: new Date("2026-11-01T18:00"),
        endsAt: new Date("2026-11-01T20:30"),
      }),
    );
  });

  it("keeps an omitted end timestamp valid when creating an event", async () => {
    mocks.createEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await createEventAction(
      {},
      createFormData({ ...validCreateFields, endsAt: "" }),
    );

    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({ endsAt: undefined }));
  });

  it("passes the fixed optional-field catalog toggles through to createEvent (spec.md 'Fixed Optional Field Catalog')", async () => {
    mocks.createEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await createEventAction(
      {},
      createFormData({ ...validCreateFields, collectCompany: "true", collectJobTitle: "" }),
    );

    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ collectCompany: true, collectJobTitle: false }),
    );
  });

  it("returns a validation error without calling the service for malformed input", async () => {
    const result = await createEventAction({}, createFormData({ name: "", slug: "", startsAt: "" }));

    expect(result).toEqual({ error: "Revisa los datos del evento." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("publishes an event for ADMIN and revalidates both the list and edit page", async () => {
    mocks.setEventStatus.mockResolvedValue({ ok: true, event: { id: "event-1", status: "published" } });

    await publishEventAction(createFormData({ id: "11111111-1111-4111-8111-111111111111" }));

    expect(mocks.setEventStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published", actorRole: "ADMIN" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/events");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/events/11111111-1111-4111-8111-111111111111/edit",
    );
  });

  it("closes an event for ADMIN", async () => {
    mocks.setEventStatus.mockResolvedValue({ ok: true, event: { id: "event-1", status: "closed" } });

    await closeEventAction(createFormData({ id: "11111111-1111-4111-8111-111111111111" }));

    expect(mocks.setEventStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "closed" }),
    );
  });

  it("archives and restores an event for ADMIN and revalidates its pages", async () => {
    mocks.archiveEvent.mockResolvedValue({ ok: true, event: { id: "event-1", status: "archived" } });
    mocks.restoreEvent.mockResolvedValue({ ok: true, event: { id: "event-1", status: "published" } });
    const form = createFormData({ id: "11111111-1111-4111-8111-111111111111" });

    await archiveEventAction(form);
    await restoreEventAction(form);

    expect(mocks.archiveEvent).toHaveBeenCalledWith(expect.objectContaining({ actorRole: "ADMIN", organizationId: "org-1" }));
    expect(mocks.restoreEvent).toHaveBeenCalledWith(expect.objectContaining({ actorRole: "ADMIN", organizationId: "org-1" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/events");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/events/11111111-1111-4111-8111-111111111111");
  });

  it("returns a clear delete error when registrations prevent deletion", async () => {
    mocks.deleteEvent.mockResolvedValue({ ok: false, reason: "has_registrations" });

    const result = await deleteEventAction({}, createFormData({ id: "11111111-1111-4111-8111-111111111111" }));

    expect(result).toEqual({ error: "No se puede eliminar un evento con registros." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("clears a previously-set description/location by mapping an empty submitted field to explicit null, not undefined (verify-report W2)", async () => {
    mocks.updateEvent.mockResolvedValue({
      ok: true,
      event: { id: "event-1", description: null, location: null },
    });

    await updateEventAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        description: "",
        location: "",
      }),
    );

    // UpdateEventChanges types description/location as `string | null` specifically to allow
    // clearing — Drizzle's `.set()` skips `undefined` keys, so only an explicit `null` here (not
    // `undefined`) actually clears the stored value in `updateEvent`.
    expect(mocks.updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.objectContaining({ description: null, location: null }),
      }),
    );
  });

  it("clears a previously-set direct Maps URL while preserving a submitted edit reminder", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1", locationUrl: null } });

    await updateEventAction({}, createFormData({
      id: "11111111-1111-4111-8111-111111111111",
      locationUrl: "",
      reminderOffsetMinutes: "2880",
    }));

    expect(mocks.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      changes: expect.objectContaining({ locationUrl: null, reminderOffsetMinutes: 2880 }),
    }));
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) (
    "rejects an unsafe edit URL scheme: %s",
    async (locationUrl) => {
      const result = await updateEventAction({}, createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        locationUrl,
      }));

      expect(result).toEqual({ error: "Revisa los datos del evento." });
      expect(mocks.updateEvent).not.toHaveBeenCalled();
    },
  );

  it("passes combined start and populated end timestamps to updateEvent", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await updateEventAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        startsAt: "2026-11-01T18:00",
        endsAt: "2026-11-01T20:30",
      }),
    );

    expect(mocks.updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.objectContaining({
          startsAt: new Date("2026-11-01T18:00"),
          endsAt: new Date("2026-11-01T20:30"),
        }),
      }),
    );
  });

  it("maps an explicitly empty end timestamp to null when updating an event", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await updateEventAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        startsAt: "2026-11-01T18:00",
        endsAt: "",
      }),
    );

    expect(mocks.updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ changes: expect.objectContaining({ endsAt: null }) }),
    );
  });

  it("leaves an omitted end timestamp undefined when updating an event", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await updateEventAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        startsAt: "2026-11-01T18:00",
      }),
    );

    expect(mocks.updateEvent.mock.calls[0][0].changes.endsAt).toBeUndefined();
  });

  it("leaves an omitted reminder offset undefined when updating an event", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await updateEventAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        startsAt: "2026-11-01T18:00",
      }),
    );

    expect(mocks.updateEvent.mock.calls[0][0].changes.reminderOffsetMinutes).toBeUndefined();
  });

  it("rejects an edit with an empty required start timestamp", async () => {
    const result = await updateEventAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        startsAt: "",
      }),
    );

    expect(result).toEqual({ error: "Revisa los datos del evento." });
    expect(mocks.updateEvent).not.toHaveBeenCalled();
  });

  it("leaves description/location untouched (undefined) when the field key is not submitted at all", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1", name: "Renamed" } });

    await updateEventAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111", name: "Renamed" }),
    );

    const call = mocks.updateEvent.mock.calls[0][0];
    expect(call.changes.description).toBeUndefined();
    expect(call.changes.location).toBeUndefined();
  });

  it("creates an event with a hero image, agenda, and sponsor logos", async () => {
    mocks.createEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });
    const agenda = [{ time: "10:00 AM", title: "Registro" }];
    const sponsorLogos = [{ url: "https://cdn.example.com/sponsor.png", name: "Acme" }];

    await createEventAction(
      {},
      createFormData({
        ...validCreateFields,
        heroImageUrl: "https://cdn.example.com/hero.jpg",
        agenda: JSON.stringify(agenda),
        sponsorLogos: JSON.stringify(sponsorLogos),
      }),
    );

    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        heroImageUrl: "https://cdn.example.com/hero.jpg",
        agenda,
        sponsorLogos,
      }),
    );
  });

  it("defaults agenda and sponsorLogos to empty arrays when not submitted", async () => {
    mocks.createEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await createEventAction({}, createFormData(validCreateFields));

    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ agenda: [], sponsorLogos: [] }),
    );
  });

  it("rejects malformed agenda JSON without calling the service", async () => {
    const result = await createEventAction(
      {},
      createFormData({ ...validCreateFields, agenda: "not-json" }),
    );

    expect(result).toEqual({ error: "Revisa los datos del evento." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("rejects an agenda item missing a title without calling the service", async () => {
    const result = await createEventAction(
      {},
      createFormData({ ...validCreateFields, agenda: JSON.stringify([{ time: "10:00 AM", title: "" }]) }),
    );

    expect(result).toEqual({ error: "Revisa los datos del evento." });
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it("updates an event's hero image, agenda, and sponsor logos", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });
    const agenda = [{ time: "9:00 AM", title: "Apertura" }];

    await updateEventAction(
      {},
      createFormData({
        id: "11111111-1111-4111-8111-111111111111",
        heroImageUrl: "https://cdn.example.com/hero.jpg",
        agenda: JSON.stringify(agenda),
        sponsorLogos: JSON.stringify([]),
      }),
    );

    const call = mocks.updateEvent.mock.calls[0][0];
    expect(call.changes.heroImageUrl).toBe("https://cdn.example.com/hero.jpg");
    expect(call.changes.agenda).toEqual(agenda);
    expect(call.changes.sponsorLogos).toEqual([]);
  });

  it("clears a previously-set hero image by mapping an empty submitted field to explicit null", async () => {
    mocks.updateEvent.mockResolvedValue({ ok: true, event: { id: "event-1" } });

    await updateEventAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111", heroImageUrl: "" }),
    );

    const call = mocks.updateEvent.mock.calls[0][0];
    expect(call.changes.heroImageUrl).toBeNull();
  });

  it("rejects a webhook URL update for a non-admin without calling the service", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const result = await setWebhookAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111", webhookUrl: "https://example.com/hook" }),
    );

    expect(result.error).toBeTruthy();
    expect(mocks.setEventWebhookUrl).not.toHaveBeenCalled();
  });

  it("sets the webhook URL and surfaces the generated secret", async () => {
    mocks.setEventWebhookUrl.mockResolvedValue({
      ok: true,
      event: { id: "event-1", webhookUrl: "https://example.com/hook", webhookSecret: "new-secret" },
    });

    const result = await setWebhookAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111", webhookUrl: "https://example.com/hook" }),
    );

    expect(mocks.setEventWebhookUrl).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrl: "https://example.com/hook", actorRole: "ADMIN" }),
    );
    expect(result).toEqual({ success: "Webhook actualizado.", webhookSecret: "new-secret" });
  });

  it("clears the webhook URL when submitted empty", async () => {
    mocks.setEventWebhookUrl.mockResolvedValue({
      ok: true,
      event: { id: "event-1", webhookUrl: null, webhookSecret: null },
    });

    await setWebhookAction({}, createFormData({ id: "11111111-1111-4111-8111-111111111111", webhookUrl: "" }));

    expect(mocks.setEventWebhookUrl).toHaveBeenCalledWith(expect.objectContaining({ webhookUrl: null }));
  });

  it("surfaces an unsafe_url rejection with its own friendly message", async () => {
    mocks.setEventWebhookUrl.mockResolvedValue({ ok: false, reason: "unsafe_url" });

    const result = await setWebhookAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111", webhookUrl: "https://169.254.169.254/" }),
    );

    expect(result.error).toMatch(/https/i);
  });

  it("rejects secret regeneration for a non-admin without calling the service", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const result = await regenerateWebhookSecretAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111" }),
    );

    expect(result.error).toBeTruthy();
    expect(mocks.regenerateEventWebhookSecret).not.toHaveBeenCalled();
  });

  it("regenerates the secret for ADMIN", async () => {
    mocks.regenerateEventWebhookSecret.mockResolvedValue({
      ok: true,
      event: { id: "event-1", webhookSecret: "rotated-secret" },
    });

    const result = await regenerateWebhookSecretAction(
      {},
      createFormData({ id: "11111111-1111-4111-8111-111111111111" }),
    );

    expect(result).toEqual({ success: "Secreto regenerado.", webhookSecret: "rotated-secret" });
  });
});
