import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  getEvent: vi.fn(),
  canAccessEvent: vi.fn(),
  listEventChecklist: vi.fn(),
  listEventAssignees: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));
vi.mock("@/modules/events", () => ({
  canAccessEvent: mocks.canAccessEvent,
  getEvent: mocks.getEvent,
  listEventChecklist: mocks.listEventChecklist,
  listEventAssignees: mocks.listEventAssignees,
}));

import { GET } from "./route";

const eventId = "event-1";

function invoke() {
  return GET({} as NextRequest, { params: Promise.resolve({ id: eventId }) });
}

describe("GET /events/[id]/organization/export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", profile: { organizationId: "org-1", role: "RECEPTION", status: "active" } });
    mocks.isActive.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({ id: eventId, slug: "boda-garcia", name: "Boda García" });
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.listEventChecklist.mockResolvedValue([]);
    mocks.listEventAssignees.mockResolvedValue([]);
  });

  it("returns 401 when there is no active user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    expect((await invoke()).status).toBe(401);
  });

  it("returns 404 when the event does not belong to the organization", async () => {
    mocks.getEvent.mockResolvedValue(undefined);

    expect((await invoke()).status).toBe(404);
  });

  it("returns 403 when the user cannot access the organization tab", async () => {
    mocks.canAccessEvent.mockResolvedValue(false);

    expect((await invoke()).status).toBe(403);
    expect(mocks.listEventChecklist).not.toHaveBeenCalled();
  });

  it("streams a CSV attachment for the event checklist", async () => {
    mocks.listEventChecklist.mockResolvedValue([
      {
        id: "group-1",
        title: "Hotel",
        tasks: [{ id: "task-1", title: "Confirmar proveedores", completed: false, assigneeId: null, dueDate: null, notes: null, subtasks: [] }],
      },
    ]);

    const response = await invoke();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="organizacion_boda-garcia.csv"');
    expect(body).toContain("Confirmar proveedores");
    expect(body).toContain("Hotel");
  });
});
