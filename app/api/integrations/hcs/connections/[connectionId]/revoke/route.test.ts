import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsRequest: vi.fn(),
  revokeHcsConnection: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  errorResponse: (error: number | { status?: number }) =>
    new Response(JSON.stringify({ error: "Request could not be processed" }), {
      status: typeof error === "number" ? error : error.status ?? 400,
      headers: { "content-type": "application/json" },
    }),
  revokeHcsConnection: mocks.revokeHcsConnection,
}));

import { POST } from "./route";

const connectionId = "11111111-1111-4111-8111-111111111111";

function requestWith(headers: Record<string, string> = {}, body = ""): NextRequest {
  return new Request(`https://app.example.com/api/integrations/hcs/connections/${connectionId}/revoke`, {
    method: "POST",
    headers,
    body: body || undefined,
  }) as unknown as NextRequest;
}

function params(id = connectionId) {
  return { params: Promise.resolve({ connectionId: id }) };
}

describe("POST /api/integrations/hcs/connections/[connectionId]/revoke", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateHcsRequest.mockResolvedValue({
      connection: { id: connectionId, organizationId: "org-1", hcsCompanyId: "company-1" },
    });
    mocks.revokeHcsConnection.mockResolvedValue({
      id: connectionId,
      organizationId: "org-1",
      revokedAt: new Date("2026-10-16T12:00:00.000Z"),
    });
  });

  it("requires actor id and email headers", async () => {
    const response = await POST(requestWith({ authorization: "Bearer current-token", "x-hcs-company-id": "company-1" }), params());

    expect(response.status).toBe(400);
    expect(mocks.authenticateHcsRequest).not.toHaveBeenCalled();
  });

  it("rejects a path mismatch and never revokes another connection", async () => {
    const response = await POST(requestWith({
      authorization: "Bearer current-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params("22222222-2222-4222-8222-222222222222"));

    expect(response.status).toBe(403);
    expect(mocks.revokeHcsConnection).not.toHaveBeenCalled();
  });

  it("invalidates the current token and returns exactly the revocation contract", async () => {
    const response = await POST(requestWith({
      authorization: "Bearer current-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      connectionId,
      revokedAt: "2026-10-16T12:00:00.000Z",
    });
    expect(mocks.revokeHcsConnection).toHaveBeenCalledWith({
      organizationId: "org-1",
      connectionId,
    });
  });

  it("does not accept a body or persist/expose the bearer secret", async () => {
    const response = await POST(requestWith({
      authorization: "Bearer current-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
      "content-type": "application/json",
    }, JSON.stringify({ requestedBy: "actor-1", name: "Acme", token: "current-token" })), params());

    expect(response.status).toBe(400);
    expect(mocks.revokeHcsConnection).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("current-token");
  });

  it("maps authentication and missing connection errors generically", async () => {
    mocks.authenticateHcsRequest.mockRejectedValueOnce({ status: 403 });
    expect((await POST(requestWith({
      authorization: "Bearer current-token",
      "x-hcs-company-id": "company-2",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params())).status).toBe(403);

    mocks.revokeHcsConnection.mockResolvedValueOnce(undefined);
    expect((await POST(requestWith({
      authorization: "Bearer current-token",
      "x-hcs-company-id": "company-1",
      "x-hcs-actor-id": "actor-1",
      "x-hcs-actor-email": "actor@example.com",
    }), params())).status).toBe(404);
  });
});
