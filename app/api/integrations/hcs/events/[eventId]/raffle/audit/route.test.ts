import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsRequest: vi.fn(),
  getEvent: vi.fn(),
  getRaffleForEvent: vi.fn(),
  listRaffleAudit: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  errorResponse: (error: number | { status?: number }) => new Response(JSON.stringify({ error: "Request could not be processed" }), { status: typeof error === "number" ? error : error.status ?? 400 }),
}));
vi.mock("@/modules/events", () => ({ getEvent: mocks.getEvent }));
vi.mock("@/modules/raffles", () => ({
  getRaffleForEvent: mocks.getRaffleForEvent,
  listRaffleAudit: mocks.listRaffleAudit,
}));

import { GET } from "./route";

function request(): NextRequest {
  return {} as NextRequest;
}

describe("GET /api/integrations/hcs/events/[eventId]/raffle/audit", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.getEvent.mockResolvedValue({ id: "event-1", organizationId: "org-1" });
    mocks.getRaffleForEvent.mockResolvedValue({ id: "raffle-1", eventId: "event-1", organizationId: "org-1" });
    mocks.listRaffleAudit.mockResolvedValue([
      {
        id: "audit-1",
        action: "resend_request",
        prizeId: "prize-1",
        drawId: "draw-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        actorExternalId: "hcs-actor-1",
        actorSource: "hcs",
        actorEmail: "actor@example.com",
        actorExternalEmail: "external@example.com",
        metadata: {
          reason: "requested again",
          previousStatus: "revealed",
          status: "claimed",
          requestId: "request-1",
          connectionId: "connection-1",
          note: "safe note",
          providerResult: { status: "sent" },
          attendeeEmail: "attendee@example.com",
        },
      },
      {
        id: "audit-2",
        action: "validate",
        prizeId: null,
        drawId: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        actorExternalId: null,
        actorSource: "hcs",
        actorEmail: "another@example.com",
        actorExternalEmail: null,
        metadata: {},
      },
    ]);
  });

  it("returns only the stable audit projection and redacts PII and unsafe metadata", async () => {
    const response = await GET(request(), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.getEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(mocks.getRaffleForEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(mocks.listRaffleAudit).toHaveBeenCalledWith({ raffleId: "raffle-1", eventId: "event-1", organizationId: "org-1" });
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      audit: [
        {
          id: "audit-1",
          action: "resend_request",
          prizeId: "prize-1",
          drawId: "draw-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          actorId: "hcs-actor-1",
          actorSource: "hcs",
          metadata: {
            reason: "requested again",
            previousStatus: "revealed",
            status: "claimed",
            requestId: "request-1",
            connectionId: "connection-1",
            note: "safe note",
          },
        },
        {
          id: "audit-2",
          action: "validate",
          prizeId: null,
          drawId: null,
          createdAt: "2026-01-02T00:00:00.000Z",
          actorId: null,
          actorSource: "hcs",
          metadata: {},
        },
      ],
    });
    expect(JSON.stringify(responseBody)).not.toContain("@example.com");
  });

  it("returns 404 for an event outside the connection organization and does not query its raffle", async () => {
    mocks.getEvent.mockResolvedValue(undefined);

    const response = await GET(request(), { params: Promise.resolve({ eventId: "event-other-org" }) });

    expect(response.status).toBe(404);
    expect(mocks.getEvent).toHaveBeenCalledWith("event-other-org", "org-1");
    expect(mocks.getRaffleForEvent).not.toHaveBeenCalled();
    expect(mocks.listRaffleAudit).not.toHaveBeenCalled();
  });

  it("returns 404 when the scoped event has no raffle", async () => {
    mocks.getRaffleForEvent.mockResolvedValue(undefined);

    const response = await GET(request(), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(404);
    expect(mocks.listRaffleAudit).not.toHaveBeenCalled();
  });

  it("preserves authentication errors", async () => {
    mocks.authenticateHcsRequest.mockRejectedValue({ status: 403 });

    const response = await GET(request(), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.getEvent).not.toHaveBeenCalled();
  });
});
