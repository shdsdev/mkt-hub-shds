import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsRequest: vi.fn(),
  renewHcsConnection: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  errorResponse: (error: number | { status?: number }) =>
    new Response(JSON.stringify({ error: "Request could not be processed" }), {
      status: typeof error === "number" ? error : error.status ?? 400,
      headers: { "content-type": "application/json" },
    }),
  renewHcsConnection: mocks.renewHcsConnection,
}));

import { POST } from "./route";

const connectionId = "11111111-1111-4111-8111-111111111111";
const otherConnectionId = "22222222-2222-4222-8222-222222222222";

function requestWith(headers: Record<string, string> = {}, body = ""): NextRequest {
  return new Request(`https://app.example.com/api/integrations/hcs/connections/${connectionId}/renew`, {
    method: "POST",
    headers,
    body: body || undefined,
  }) as unknown as NextRequest;
}

function params(id = connectionId) {
  return { params: Promise.resolve({ connectionId: id }) };
}

describe("POST /api/integrations/hcs/connections/[connectionId]/renew", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.HCS_CONNECTION_EXPIRY_DAYS = "30";
    mocks.authenticateHcsRequest.mockResolvedValue({
      connection: { id: connectionId, organizationId: "org-1", hcsCompanyId: "company-1" },
    });
    mocks.renewHcsConnection.mockResolvedValue({
      connection: {
        id: connectionId,
        organizationId: "org-1",
        expiresAt: new Date("2026-11-15T00:00:00.000Z"),
      },
      accessToken: "new-opaque-token",
    });
  });

  it("requires the current bearer/company authentication and actor headers", async () => {
    const response = await POST(requestWith({ authorization: "Bearer old-token", "x-hcs-company-id": "company-1" }), params());

    expect(response.status).toBe(400);
    expect(mocks.authenticateHcsRequest).not.toHaveBeenCalled();
  });

  it("maps authentication failures to generic statuses", async () => {
    mocks.authenticateHcsRequest.mockRejectedValue({ status: 401 });
    const response = await POST(requestWith({
      authorization: "Bearer old-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params());

    expect(response.status).toBe(401);
    const body = await response.text();
    expect(body).not.toContain("old-token");
    expect(body).not.toContain("actor@example.com");
  });

  it("rejects a malformed or mismatched connection path before mutation", async () => {
    const malformed = await POST(requestWith({
      authorization: "Bearer old-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params("not-a-uuid"));
    expect(malformed.status).toBe(400);

    const mismatch = await POST(requestWith({
      authorization: "Bearer old-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params(otherConnectionId));
    expect(mismatch.status).toBe(403);
    expect(mocks.renewHcsConnection).not.toHaveBeenCalled();
  });

  it("rejects requestedBy/name body fields because the lifecycle body is empty", async () => {
    const response = await POST(requestWith({
      authorization: "Bearer old-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
      "content-type": "application/json",
    }, JSON.stringify({ requestedBy: "actor-1", name: "Acme" })), params());

    expect(response.status).toBe(400);
    expect(mocks.renewHcsConnection).not.toHaveBeenCalled();
  });

  it("rotates the token, scopes the mutation, uses configured expiry, and returns only the new secret", async () => {
    const before = Date.now();
    const response = await POST(requestWith({
      authorization: "Bearer old-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params());
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      connectionId,
      accessToken: "new-opaque-token",
      expiresAt: "2026-11-15T00:00:00.000Z",
    });
    expect(mocks.renewHcsConnection).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      connectionId,
      expiresAt: expect.any(Date),
    }));
    const expiresAt = mocks.renewHcsConnection.mock.calls[0][0].expiresAt.getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 30 * 86_400_000);
    expect(expiresAt).toBeLessThanOrEqual(after + 30 * 86_400_000);
    expect(JSON.stringify(mocks.renewHcsConnection.mock.calls[0][0])).not.toContain("new-opaque-token");
  });

  it("does not expose service errors or secrets", async () => {
    mocks.renewHcsConnection.mockRejectedValue(new Error("database failed with old-token"));
    const response = await POST(requestWith({
      authorization: "Bearer old-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params());

    expect(response.status).toBe(409);
    const body = await response.text();
    expect(body).not.toContain("database");
    expect(body).not.toContain("old-token");
  });
});
