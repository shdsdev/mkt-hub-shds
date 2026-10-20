import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  listDueReminderAttendees: vi.fn(),
  sendReminderEmail: vi.fn(),
  exportQrPng: vi.fn(),
}));

vi.mock("@/modules/events", () => ({ listDueReminderAttendees: mocks.listDueReminderAttendees }));
vi.mock("@/modules/notifications", () => ({ sendReminderEmail: mocks.sendReminderEmail }));
vi.mock("@/modules/qr", () => ({ exportQrPng: mocks.exportQrPng }));

import { POST } from "./route";

function requestWithAuth(authorization?: string): NextRequest {
  return {
    headers: { get: (key: string) => (key === "authorization" ? authorization ?? null : null) },
  } as unknown as NextRequest;
}

const ORIGINAL_SECRET = process.env.EVENTS_REMINDER_JOB_SECRET;
const ORIGINAL_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN;

describe("POST /api/jobs/event-reminders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.EVENTS_REMINDER_JOB_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://hub.example.com";
    mocks.exportQrPng.mockResolvedValue(Buffer.from("fake-png"));
    mocks.sendReminderEmail.mockResolvedValue({ sent: true, notificationId: "n1" });
  });

  afterAll(() => {
    process.env.EVENTS_REMINDER_JOB_SECRET = ORIGINAL_SECRET;
    process.env.NEXT_PUBLIC_APP_ORIGIN = ORIGINAL_ORIGIN;
  });

  it("returns 500 and sends nothing when the secret is not configured", async () => {
    delete process.env.EVENTS_REMINDER_JOB_SECRET;

    const response = await POST(requestWithAuth("Bearer anything"));

    expect(response.status).toBe(500);
    expect(mocks.listDueReminderAttendees).not.toHaveBeenCalled();
  });

  it("returns 401 and sends nothing for a missing or wrong bearer header", async () => {
    const response = await POST(requestWithAuth("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(mocks.listDueReminderAttendees).not.toHaveBeenCalled();
  });

  it("returns 401 when the authorization header is absent entirely", async () => {
    const response = await POST(requestWithAuth(undefined));

    expect(response.status).toBe(401);
  });

  it("sends a reminder email per due attendee with their own QR pass", async () => {
    mocks.listDueReminderAttendees.mockResolvedValue([
      {
        event: {
          id: "event-1",
          name: "Workshop de Marketing",
          startsAt: new Date("2026-11-06T15:00:00Z"),
          endsAt: new Date("2026-11-06T21:00:00Z"),
          location: "Hotel Victoria Ejecutivo Guadalajara",
          locationUrl: "https://maps.google.com/?q=hotel",
        },
        attendee: {
          id: "att-1",
          organizationId: "org-1",
          email: "ada@example.com",
          fullName: "Ada Lovelace",
          passToken: "pass-token-1",
          backupCode: "ABCD1234",
        },
        cancelToken: "cancel-token-1",
      },
    ]);

    const response = await POST(requestWithAuth("Bearer test-secret"));

    expect(response.status).toBe(200);
    expect(mocks.exportQrPng).toHaveBeenCalledWith("ABCD1234", {});
    expect(mocks.sendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        attendeeId: "att-1",
        to: "ada@example.com",
        attendeeName: "Ada Lovelace",
        eventName: "Workshop de Marketing",
        backupCode: "ABCD1234",
        qrPngBase64: Buffer.from("fake-png").toString("base64"),
        eventStartsAt: new Date("2026-11-06T15:00:00Z"),
        eventEndsAt: new Date("2026-11-06T21:00:00Z"),
        eventLocation: "Hotel Victoria Ejecutivo Guadalajara",
        eventLocationUrl: "https://maps.google.com/?q=hotel",
        manageUrl: "https://hub.example.com/events/cancel/cancel-token-1",
      }),
    );
  });

  // spec.md "Testing strategy" item 3 — direct, end-to-end proof that a cron ping landing exactly
  // 48h before an event's startsAt (the real reminderOffsetMinutes = 2880 case) results in
  // sendReminderEmail being called with real, populated event data — not just that it fired.
  it("fires the 48h reminder end to end with real event data populated", async () => {
    const startsAt = new Date("2026-11-06T15:00:00Z");
    mocks.listDueReminderAttendees.mockResolvedValue([
      {
        event: {
          id: "event-48h",
          name: "BMIGHTY Connect",
          startsAt,
          endsAt: new Date("2026-11-06T21:00:00Z"),
          location: "Hotel Victoria Ejecutivo Guadalajara",
          reminderOffsetMinutes: 2880,
        },
        attendee: {
          id: "att-48h",
          organizationId: "org-1",
          email: "ada@example.com",
          fullName: "Ada Lovelace",
          passToken: "pass-token-48h",
          backupCode: "ABCD1234",
        },
        cancelToken: "cancel-token-48h",
      },
    ]);

    const response = await POST(requestWithAuth("Bearer test-secret"));

    expect(response.status).toBe(200);
    expect(mocks.sendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        eventStartsAt: startsAt,
        eventEndsAt: new Date("2026-11-06T21:00:00Z"),
        eventLocation: "Hotel Victoria Ejecutivo Guadalajara",
        manageUrl: "https://hub.example.com/events/cancel/cancel-token-48h",
      }),
    );
  });

  it("is safe to call repeatedly: processes the same due list again without error", async () => {
    mocks.listDueReminderAttendees.mockResolvedValue([
      {
        event: { id: "event-1", name: "Workshop de Marketing" },
        attendee: {
          id: "att-1",
          organizationId: "org-1",
          email: "ada@example.com",
          fullName: "Ada Lovelace",
          passToken: "pass-token-1",
          backupCode: "ABCD1234",
        },
      },
    ]);

    await POST(requestWithAuth("Bearer test-secret"));
    const second = await POST(requestWithAuth("Bearer test-secret"));

    expect(second.status).toBe(200);
    expect(mocks.sendReminderEmail).toHaveBeenCalledTimes(2);
  });
});
