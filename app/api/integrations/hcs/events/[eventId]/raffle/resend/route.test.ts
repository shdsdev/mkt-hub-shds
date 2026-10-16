import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsRequest: vi.fn(),
  runIdempotentResponse: vi.fn(),
  resendHcsWinnerEmail: vi.fn(),
  checkHcsRaffleResendRateLimit: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  runIdempotentResponse: mocks.runIdempotentResponse,
  errorResponse: (error: number | { status?: number }) => new Response(JSON.stringify({ error: "Request could not be processed" }), { status: typeof error === "number" ? error : error.status ?? 400 }),
}));
vi.mock("@/modules/raffles", () => ({ resendHcsWinnerEmail: mocks.resendHcsWinnerEmail }));
vi.mock("@/modules/audit", () => ({ checkHcsRaffleResendRateLimit: mocks.checkHcsRaffleResendRateLimit }));

import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return {
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as NextRequest;
}

const body = {
  drawId: "00000000-0000-4000-8000-000000000001",
  actor: { userId: "hcs-actor-1", email: "actor@example.com", name: "Winner <script>" },
  reason: "The attendee requested the message again",
  idempotencyKey: "resend-1",
};

const headers = {
  "idempotency-key": body.idempotencyKey,
  "x-hcs-actor-id": body.actor.userId,
  "x-hcs-actor-email": body.actor.email,
};

describe("POST /api/integrations/hcs/events/[eventId]/raffle/resend", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateHcsRequest.mockResolvedValue({ connection: { id: "connection-1", organizationId: "org-1" } });
    mocks.checkHcsRaffleResendRateLimit.mockReturnValue(true);
    mocks.resendHcsWinnerEmail.mockResolvedValue({ status: "resent", sentAt: new Date("2026-01-01T00:00:00.000Z") });
    mocks.runIdempotentResponse.mockImplementation(async ({ execute }: { execute: (client: unknown) => Promise<{ status: number; body: Record<string, unknown> }> }) => ({ ...(await execute({})), replayed: false }));
  });

  it("returns the exact success shape without winner PII", async () => {
    const response = await POST(request(body, headers), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({ success: true, email: { status: "resent", sentAt: "2026-01-01T00:00:00.000Z" } });
    expect(JSON.stringify(responseBody)).not.toContain("<script>");
    expect(mocks.resendHcsWinnerEmail).toHaveBeenCalledWith(expect.not.objectContaining({ client: expect.anything() }));
  });

  it("rejects actor mismatches before mutation", async () => {
    const response = await POST(request({ ...body, actor: { ...body.actor, email: "other@example.com" } }, headers), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.runIdempotentResponse).not.toHaveBeenCalled();
  });

  it("rejects a missing idempotency key", async () => {
    const response = await POST(request(body, { "x-hcs-actor-id": body.actor.userId, "x-hcs-actor-email": body.actor.email }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.runIdempotentResponse).not.toHaveBeenCalled();
  });

  it("returns 409 when the body and header idempotency keys differ", async () => {
    const response = await POST(request({ ...body, idempotencyKey: "other-key" }, headers), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(409);
    expect(mocks.runIdempotentResponse).not.toHaveBeenCalled();
  });

  it("maps invalidated draws to a generic 409", async () => {
    mocks.resendHcsWinnerEmail.mockRejectedValue(Object.assign(new Error("Draw invalidated"), { status: 409 }));

    const response = await POST(request(body, headers), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Request could not be processed" });
  });

  it("returns 429 for a new request over the connection and actor limit", async () => {
    mocks.checkHcsRaffleResendRateLimit.mockReturnValue(false);

    const response = await POST(request(body, headers), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(429);
    expect(mocks.resendHcsWinnerEmail).not.toHaveBeenCalled();
  });

  it("keeps an idempotent replay available even when the new-send limiter is exhausted", async () => {
    const replay = { success: true, email: { status: "resent", sentAt: "2026-01-01T00:00:00.000Z" } };
    mocks.checkHcsRaffleResendRateLimit.mockReturnValue(false);
    mocks.runIdempotentResponse.mockResolvedValue({ status: 200, body: replay, replayed: true });

    const response = await POST(request(body, headers), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(replay);
    expect(mocks.checkHcsRaffleResendRateLimit).not.toHaveBeenCalled();
    expect(mocks.resendHcsWinnerEmail).not.toHaveBeenCalled();
  });

  it("maps idempotency payload mismatches to 409", async () => {
    mocks.runIdempotentResponse.mockRejectedValue(new Error("Idempotency key payload mismatch"));

    const response = await POST(request({ ...body, reason: "Different reason" }, headers), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Request could not be processed" });
  });

  it("allows a provider failure to be retried as a resend", async () => {
    mocks.resendHcsWinnerEmail
      .mockRejectedValueOnce(new Error("provider failure"))
      .mockResolvedValueOnce({ status: "resent", sentAt: new Date("2026-01-01T00:00:01.000Z") });

    await expect(POST(request(body, headers), { params: Promise.resolve({ eventId: "event-1" }) })).resolves.toHaveProperty("status", 400);
    const response = await POST(request({ ...body, idempotencyKey: "resend-2" }, { ...headers, "idempotency-key": "resend-2" }), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.resendHcsWinnerEmail).toHaveBeenCalledTimes(2);
  });
});
