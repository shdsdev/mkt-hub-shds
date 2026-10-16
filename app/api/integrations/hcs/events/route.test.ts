import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsToken: vi.fn(),
  authenticateHcsRequest: vi.fn(),
  getOrganization: vi.fn(),
  listEvents: vi.fn(),
  getRaffleForEvent: vi.fn(),
  listRafflePrizes: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsToken: mocks.authenticateHcsToken,
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  errorResponse: (error: number | { status?: number }) => new Response(JSON.stringify({ error: "Request could not be processed" }), { status: typeof error === "number" ? error : error.status ?? 400 }),
}));
vi.mock("@/modules/users", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/events", () => ({ listEvents: mocks.listEvents }));
vi.mock("@/modules/raffles", () => ({ getRaffleForEvent: mocks.getRaffleForEvent, listRafflePrizes: mocks.listRafflePrizes }));

import { GET } from "./route";

function requestWith(url: string, authorization?: string, companyId?: string): NextRequest {
  return {
    url,
    headers: { get: (key: string) => key.toLowerCase() === "authorization" ? authorization ?? null : key.toLowerCase() === "x-hcs-company-id" ? companyId ?? null : null },
  } as unknown as NextRequest;
}

describe("GET /api/integrations/hcs/events", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateHcsToken.mockResolvedValue({ id: "connection-1", organizationId: "org-1", hcsCompanyId: "company-1" });
    mocks.authenticateHcsRequest.mockImplementation(async (request: NextRequest) => {
      const authorization = request.headers.get("authorization");
      const companyId = request.headers.get("x-hcs-company-id");
      const match = authorization?.match(/^Bearer\s+(\S+)$/i);
      if (!match || !companyId) throw { status: 401 };
      try {
        return { connection: await mocks.authenticateHcsToken(match[1], companyId) };
      } catch {
        throw { status: 403 };
      }
    });
    mocks.getOrganization.mockResolvedValue({ id: "org-1", name: "Acme" });
    mocks.listEvents.mockResolvedValue([
      { id: "event-1", organizationId: "org-1", name: "Published", startsAt: new Date("2026-11-01T10:00:00Z"), status: "published", secret: "do-not-return" },
      { id: "event-2", organizationId: "org-1", name: "Closed", startsAt: new Date("2026-12-01T10:00:00Z"), status: "closed" },
    ]);
    mocks.getRaffleForEvent.mockImplementation(async (eventId: string) => eventId === "event-1" ? { id: "raffle-1", status: "ready" } : undefined);
    mocks.listRafflePrizes.mockResolvedValue([{ quantity: 2, drawnQuantity: 1 }]);
  });

  it("requires both bearer authentication and the company header", async () => {
    expect((await GET(requestWith("https://app.example.com/api/integrations/hcs/events"))).status).toBe(401);
    expect((await GET(requestWith("https://app.example.com/api/integrations/hcs/events", "Bearer token"))).status).toBe(401);
    expect(mocks.authenticateHcsToken).not.toHaveBeenCalled();
  });

  it("rejects a token/company mismatch without trusting actor headers", async () => {
    mocks.authenticateHcsToken.mockRejectedValue(new Error("Token/company mismatch"));
    const response = await GET(requestWith("https://app.example.com/api/integrations/hcs/events", "Bearer token", "company-2"));

    expect(response.status).toBe(403);
    expect(mocks.authenticateHcsToken).toHaveBeenCalledWith("token", "company-2");
  });

  it("defaults to published, scopes to the connection organization, and redacts PII", async () => {
    const response = await GET(requestWith("https://app.example.com/api/integrations/hcs/events", "Bearer token", "company-1"));

    expect(response.status).toBe(200);
    expect(mocks.listEvents).toHaveBeenCalledWith("org-1");
    const body = await response.json();
    expect(body.events).toEqual([{ id: "event-1", name: "Published", startsAt: "2026-11-01T10:00:00.000Z", status: "published", raffle: { configured: true, hasAvailablePrizes: true, status: "ready" } }]);
    expect(JSON.stringify(body)).not.toContain("do-not-return");
  });

  it("allows published, closed, or both status filters and rejects other values", async () => {
    await GET(requestWith("https://app.example.com/api/integrations/hcs/events?status=closed", "Bearer token", "company-1"));
    expect(mocks.listEvents).toHaveBeenCalledWith("org-1");

    await GET(requestWith("https://app.example.com/api/integrations/hcs/events?status=published,closed", "Bearer token", "company-1"));

    const response = await GET(requestWith("https://app.example.com/api/integrations/hcs/events?status=draft", "Bearer token", "company-1"));
    expect(response.status).toBe(400);
  });
});
