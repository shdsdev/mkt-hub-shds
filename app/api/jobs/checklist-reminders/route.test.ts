import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  listDueChecklistReminders: vi.fn(),
  createInternalNotifications: vi.fn(),
}));

vi.mock("@/modules/events", () => ({ listDueChecklistReminders: mocks.listDueChecklistReminders }));
vi.mock("@/modules/notifications", () => ({ createInternalNotifications: mocks.createInternalNotifications }));

import { POST } from "./route";

function requestWithAuth(authorization?: string): NextRequest {
  return {
    headers: { get: (key: string) => (key === "authorization" ? authorization ?? null : null) },
  } as unknown as NextRequest;
}

const ORIGINAL_SECRET = process.env.EVENTS_REMINDER_JOB_SECRET;

describe("POST /api/jobs/checklist-reminders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.EVENTS_REMINDER_JOB_SECRET = "test-secret";
    mocks.createInternalNotifications.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env.EVENTS_REMINDER_JOB_SECRET = ORIGINAL_SECRET;
  });

  it("returns 500 when the secret is not configured", async () => {
    delete process.env.EVENTS_REMINDER_JOB_SECRET;

    const response = await POST(requestWithAuth("Bearer anything"));

    expect(response.status).toBe(500);
    expect(mocks.listDueChecklistReminders).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing or wrong bearer header", async () => {
    expect((await POST(requestWithAuth("Bearer wrong-secret"))).status).toBe(401);
    expect((await POST(requestWithAuth(undefined))).status).toBe(401);
    expect(mocks.listDueChecklistReminders).not.toHaveBeenCalled();
  });

  it("creates one in-app reminder per due task", async () => {
    mocks.listDueChecklistReminders.mockResolvedValue([
      {
        id: "task-1",
        organizationId: "org-1",
        eventId: "event-1",
        eventName: "Boda García",
        title: "Confirmar proveedores",
        dueDate: "2026-11-04",
        assigneeId: "user-1",
      },
    ]);

    const response = await POST(requestWithAuth("Bearer test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, processed: 1, notified: 1, failed: 0 });
    expect(mocks.createInternalNotifications).toHaveBeenCalledWith({
      organizationId: "org-1",
      recipientUserIds: ["user-1"],
      subjectId: "task-1",
      type: "checklist_task_due",
      title: "Tarea pendiente: Confirmar proveedores",
      body: "Boda García · vence el 2026-11-04",
      href: "/events/event-1/organization",
      dedupeKey: "checklist-task:task-1:2026-11-04",
    });
  });

  it("keeps processing other tasks when one notification fails", async () => {
    mocks.listDueChecklistReminders.mockResolvedValue([
      { id: "task-1", organizationId: "org-1", eventId: "event-1", eventName: "Boda", title: "A", dueDate: "2026-11-04", assigneeId: "user-1" },
      { id: "task-2", organizationId: "org-1", eventId: "event-1", eventName: "Boda", title: "B", dueDate: "2026-11-04", assigneeId: "user-2" },
    ]);
    mocks.createInternalNotifications.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(undefined);

    const response = await POST(requestWithAuth("Bearer test-secret"));
    const body = await response.json();

    expect(body).toEqual({ ok: false, processed: 2, notified: 1, failed: 1 });
    expect(mocks.createInternalNotifications).toHaveBeenCalledTimes(2);
  });
});
