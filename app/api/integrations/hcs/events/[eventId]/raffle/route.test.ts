import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authenticateHcsToken: vi.fn(),
  authenticateHcsRequest: vi.fn(),
  getOrganization: vi.fn(),
  getEvent: vi.fn(),
  getRaffleForEvent: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({
  authenticateHcsToken: mocks.authenticateHcsToken,
  authenticateHcsRequest: mocks.authenticateHcsRequest,
  errorResponse: (error: number | { status?: number }) => new Response(JSON.stringify({ error: "Request could not be processed" }), { status: typeof error === "number" ? error : error.status ?? 400 }),
}));
vi.mock("@/modules/users", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/events", () => ({ getEvent: mocks.getEvent }));
vi.mock("@/modules/raffles", () => ({ getRaffleForEvent: mocks.getRaffleForEvent }));

import { GET } from "./route";

function requestWith(authorization?: string, companyId?: string): NextRequest {
  return { headers: { get: (key: string) => key.toLowerCase() === "authorization" ? authorization ?? null : key.toLowerCase() === "x-hcs-company-id" ? companyId ?? null : null } } as unknown as NextRequest;
}

describe("GET /api/integrations/hcs/events/[eventId]/raffle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateHcsToken.mockResolvedValue({ id: "connection-1", organizationId: "org-1", hcsCompanyId: "company-1" });
    mocks.authenticateHcsRequest.mockImplementation(async (request: NextRequest) => {
      const authorization = request.headers.get("authorization");
      const companyId = request.headers.get("x-hcs-company-id");
      const match = authorization?.match(/^Bearer\s+(\S+)$/i);
      if (!match || !companyId) throw { status: 401 };
      return { connection: await mocks.authenticateHcsToken(match[1], companyId) };
    });
    mocks.getOrganization.mockResolvedValue({ id: "org-1", name: "Acme" });
    mocks.getEvent.mockResolvedValue({ id: "event-1", organizationId: "org-1", name: "Published", status: "published", privateEmail: "hidden" });
    mocks.getRaffleForEvent.mockResolvedValue({ id: "raffle-1", eventId: "event-1", organizationId: "org-1", status: "active" });
  });

  it("returns the scoped raffle and fixed capabilities without PII", async () => {
    const response = await GET(requestWith("Bearer token", "company-1"), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.getEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(mocks.getRaffleForEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(await response.json()).toEqual({ event: { id: "event-1", name: "Published", status: "published" }, raffle: { id: "raffle-1", status: "active" }, capabilities: { canValidate: true, canClaim: true, canResend: true } });
  });

  it("returns 404 when the event has no raffle", async () => {
    mocks.getRaffleForEvent.mockResolvedValue(undefined);

    const response = await GET(requestWith("Bearer token", "company-1"), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(404);
  });

  it("returns 403 for an organization-denied event and never queries its raffle", async () => {
    mocks.getEvent.mockResolvedValue(undefined);

    const response = await GET(requestWith("Bearer token", "company-1"), { params: Promise.resolve({ eventId: "event-1" }) });

    expect(response.status).toBe(404);
    expect(mocks.getRaffleForEvent).not.toHaveBeenCalled();
  });
});
