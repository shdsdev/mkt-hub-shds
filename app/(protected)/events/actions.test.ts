import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  setEventStatus: vi.fn(),
  setEventWebhookUrl: vi.fn(),
  regenerateEventWebhookSecret: vi.fn(),
  registrationFormConfigSchema: {
    _parse(input: { data: unknown }) {
      return { status: "valid", value: input.data };
    },
  },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({
  createEvent: mocks.createEvent,
  updateEvent: mocks.updateEvent,
  setEventStatus: mocks.setEventStatus,
  setEventWebhookUrl: mocks.setEventWebhookUrl,
  regenerateEventWebhookSecret: mocks.regenerateEventWebhookSecret,
  registrationFormConfigSchema: mocks.registrationFormConfigSchema,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createEventAction,
  updateEventAction,
  publishEventAction,
  closeEventAction,
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

    const result = await createEventAction({}, createFormData(validCreateFields));

    expect(result).toEqual({ success: "Evento creado.", eventId: "event-1" });
    expect(mocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        actorRole: "ADMIN",
        name: "Launch Day",
        slug: "launch-day",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/events");
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
