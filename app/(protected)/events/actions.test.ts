import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  setEventStatus: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({
  createEvent: mocks.createEvent,
  updateEvent: mocks.updateEvent,
  setEventStatus: mocks.setEventStatus,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  createEventAction,
  updateEventAction,
  publishEventAction,
  closeEventAction,
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
});
