import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsRequest: vi.fn(),
  claimHcsDraw: vi.fn(),
  getIdempotencyReplay: vi.fn(),
  saveIdempotencyResponse: vi.fn(),
  runIdempotentResponse: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  getIdempotencyReplay: mocks.getIdempotencyReplay,
  saveIdempotencyResponse: mocks.saveIdempotencyResponse,
  runIdempotentResponse: mocks.runIdempotentResponse,
  errorResponse: (error: number | { status?: number }) => new Response(JSON.stringify({ error: "Request could not be processed" }), { status: typeof error === "number" ? error : error.status ?? 400 }),
}));
vi.mock("@/modules/raffles", () => ({ claimHcsDraw: mocks.claimHcsDraw }));

import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return { headers: { get: (key: string) => headers[key.toLowerCase()] ?? null }, json: async () => body } as unknown as NextRequest;
}

const body = { drawId: "00000000-0000-4000-8000-000000000001", code: "ABC12345", actor: { userId: "hcs-actor-1", email: "actor@example.com", name: "Person" }, note: "Delivered", idempotencyKey: "claim-1" };

describe("POST /raffle/claims", () => {
  it("claims with the external HCS actor and stores the exact response for replay", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.runIdempotentResponse.mockImplementation(async ({ execute }: { execute: (client: unknown) => Promise<{ status: number; body: Record<string, unknown> }> }) => ({ ...(await execute({})), replayed: false }));
    mocks.claimHcsDraw.mockResolvedValue({ drawId: body.drawId, status: "claimed", claimedAt: new Date("2026-01-01T00:00:00.000Z"), claimedBy: "hcs-actor-1" });

    const response = await POST(request(body, { "idempotency-key": "claim-1", "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, claim: { drawId: body.drawId, status: "claimed", claimedAt: "2026-01-01T00:00:00.000Z", claimedBy: "hcs-actor-1" } });
    expect(mocks.runIdempotentResponse).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "connection-1", operation: "raffle.claim", key: "claim-1", request: body }));
  });

  it("rejects a missing idempotency key before mutation", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });

    const response = await POST(request(body, { "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.claimHcsDraw).not.toHaveBeenCalled();
  });

  it("returns 409 when the body and header idempotency keys differ", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });

    const response = await POST(request(body, { "idempotency-key": "other-key", "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(409);
    expect(mocks.claimHcsDraw).not.toHaveBeenCalled();
  });

  it("rejects actor identity mismatches before mutation", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });

    const response = await POST(request({ ...body, actor: { ...body.actor, email: "other@example.com" } }, { "idempotency-key": "claim-1", "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.claimHcsDraw).not.toHaveBeenCalled();
  });

  it("returns the original exact response for an idempotent replay", async () => {
    const replay = { success: true, claim: { drawId: body.drawId, status: "claimed", claimedAt: "2026-01-01T00:00:00.000Z", claimedBy: "hcs-actor-1" } };
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.runIdempotentResponse.mockResolvedValue({ status: 200, body: replay, replayed: true });

    const response = await POST(request(body, { "idempotency-key": "claim-1", "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(replay);
    expect(mocks.claimHcsDraw).not.toHaveBeenCalled();
  });

  it("returns 409 for an idempotency key reused with a different payload", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.runIdempotentResponse.mockRejectedValue(new Error("Idempotency key payload mismatch"));

    const response = await POST(request({ ...body, code: "DIFFERENT" }, { "idempotency-key": "claim-1", "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Request could not be processed" });
  });

  it("maps a claimed or expired draw conflict to 409 without exposing details", async () => {
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.runIdempotentResponse.mockImplementation(async ({ execute }: { execute: (client: unknown) => Promise<unknown> }) => execute({}));
    mocks.claimHcsDraw.mockRejectedValue(new Error("Draw cannot be claimed"));

    const response = await POST(request(body, { "idempotency-key": "claim-1", "x-hcs-actor-id": "hcs-actor-1", "x-hcs-actor-email": "actor@example.com" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Request could not be processed" });
  });
});
