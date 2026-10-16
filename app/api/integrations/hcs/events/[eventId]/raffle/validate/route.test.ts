import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsRequest: vi.fn(),
  validateRaffleCode: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  errorResponse: (error: number | { status?: number }) => new Response(JSON.stringify({ error: "Request could not be processed" }), { status: typeof error === "number" ? error : error.status ?? 400 }),
}));
vi.mock("@/modules/raffles", () => ({ validateRaffleCode: mocks.validateRaffleCode }));

import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return { headers: { get: (key: string) => headers[key.toLowerCase()] ?? null }, json: async () => body } as unknown as NextRequest;
}

describe("POST /raffle/validate", () => {
  it("returns the exact prize projection without attendee PII", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.validateRaffleCode.mockResolvedValue({ valid: true, hasPrize: true, event: { id: "event-1", name: "Launch" }, winner: { id: "draw-1", name: "Prize", prizeName: "Gift", drawId: "draw-1", drawnAt: new Date("2026-01-01T00:00:00.000Z"), claimStatus: "pending", emailStatus: "unknown" } });

    const response = await POST(request({ code: "ABC12345", actor: { userId: "hcs-actor-1", email: "actor@example.com", name: "Person" }, requestId: "request-1" }, { "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ valid: true, event: { id: "event-1", name: "Launch" }, winner: { id: "draw-1", name: "Prize", prizeName: "Gift", drawId: "draw-1", drawnAt: "2026-01-01T00:00:00.000Z", claimStatus: "pending", emailStatus: "unknown" } });
    expect(JSON.stringify(responseBody)).not.toContain("person@example.com");
    expect(mocks.validateRaffleCode).toHaveBeenCalledWith(expect.objectContaining({ eventId: "event-1", organizationId: "org-1", connectionId: "connection-1", requestId: "request-1", code: "ABC12345", actor: { type: "hcs", actorId: "hcs-actor-1", email: "actor@example.com", name: "Person", source: "hcs" } }));
  });

  it("rejects actor identity mismatches before validation", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });

    const response = await POST(request({ code: "ABC12345", actor: { userId: "different-actor", email: "actor@example.com", name: "Person" }, requestId: "request-1" }, { "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.validateRaffleCode).not.toHaveBeenCalled();
  });

  it("returns the exact no-prize contract", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.validateRaffleCode.mockResolvedValue({ valid: true, hasPrize: false, message: "Participante válido, todavía no tiene premio asignado" });

    const response = await POST(request({ code: "ABC12345", actor: { userId: "hcs-actor-1", email: "actor@example.com", name: "Person" }, requestId: "request-1" }, { "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(await response.json()).toEqual({ valid: true, hasPrize: false, message: "Participante válido, todavía no tiene premio asignado" });
  });

  it("requires the trusted HCS actor headers", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });

    const response = await POST(request({ code: "ABC12345", actor: { userId: "hcs-user-1", email: "person@example.com", name: "Person" }, requestId: "request-1" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.validateRaffleCode).not.toHaveBeenCalled();
  });

  it("returns generic not found for an unknown attendee code", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.validateRaffleCode.mockRejectedValue(Object.assign(new Error("Attendee not found"), { status: 404 }));

    const response = await POST(request({ code: "UNKNOWN1", actor: { userId: "hcs-actor-1", email: "actor@example.com", name: "Person" }, requestId: "request-1" }, { "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Request could not be processed" });
  });
});
