import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  listDueReminderAttendees: vi.fn(),
  listReminderNotificationStatuses: vi.fn(),
  summarizeReminderStatuses: vi.fn(),
}));

vi.mock("@/modules/events", () => ({ listDueReminderAttendees: mocks.listDueReminderAttendees }));
vi.mock("@/modules/notifications", () => ({
  listReminderNotificationStatuses: mocks.listReminderNotificationStatuses,
  summarizeReminderStatuses: mocks.summarizeReminderStatuses,
}));

import { GET } from "./route";

function requestWithAuth(authorization?: string): NextRequest {
  return {
    headers: { get: (key: string) => (key === "authorization" ? authorization ?? null : null) },
  } as unknown as NextRequest;
}

const originalSecret = process.env.EVENTS_REMINDER_JOB_SECRET;

describe("GET /api/jobs/event-reminders/diagnostics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.EVENTS_REMINDER_JOB_SECRET = "test-secret";
    mocks.listDueReminderAttendees.mockResolvedValue([
      { attendee: { id: "att-1" } },
      { attendee: { id: "att-2" } },
    ]);
    mocks.listReminderNotificationStatuses.mockResolvedValue([
      { attendeeId: "att-2", status: "failed" },
    ]);
    mocks.summarizeReminderStatuses.mockReturnValue({
      total: 2,
      missing: 1,
      pending: 0,
      failed: 1,
      sent: 0,
      blocked: 1,
    });
  });

  afterAll(() => {
    process.env.EVENTS_REMINDER_JOB_SECRET = originalSecret;
  });

  it("rejects requests without the job secret and performs no queries", async () => {
    const response = await GET(requestWithAuth("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(mocks.listDueReminderAttendees).not.toHaveBeenCalled();
    expect(mocks.listReminderNotificationStatuses).not.toHaveBeenCalled();
  });

  it("returns aggregate diagnostics without invoking delivery services", async () => {
    const response = await GET(requestWithAuth("Bearer test-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      reminders: {
        total: 2,
        missing: 1,
        pending: 0,
        failed: 1,
        sent: 0,
        blocked: 1,
      },
    });
    expect(mocks.listReminderNotificationStatuses).toHaveBeenCalledWith(["att-1", "att-2"]);
  });
});
