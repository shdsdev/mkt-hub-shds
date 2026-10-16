import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangePairingCode: vi.fn(),
  getOrganization: vi.fn(),
}));

vi.mock("@/modules/integrations", () => ({ exchangePairingCode: mocks.exchangePairingCode }));
vi.mock("@/modules/users", () => ({ getOrganization: mocks.getOrganization }));

import { POST } from "./route";

function requestWith(body: unknown, credential = "server-credential"): Request {
  return new Request("https://app.example.com/api/integrations/hcs/pairing/exchange", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hcs-server-token": credential },
    body: JSON.stringify(body),
  });
}

describe("POST /api/integrations/hcs/pairing/exchange", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MARKETING_HUB_SERVER_TOKEN = "server-credential";
    mocks.exchangePairingCode.mockResolvedValue({
      connection: { id: "connection-1", organizationId: "org-1", expiresAt: new Date("2026-11-01T00:00:00Z") },
      accessToken: "opaque-access-token",
    });
    mocks.getOrganization.mockResolvedValue({ id: "org-1", name: "Acme" });
  });

  it("exchanges a validated pairing request and returns the organization-scoped token", async () => {
    const response = await POST(requestWith({
      pairingCode: "PAIRING-CODE",
      hcsCompanyId: "company-1",
      hcsCompanyName: "HCS Acme",
      requestedBy: { userId: "user-1", email: "operator@example.com" },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      connectionId: "connection-1",
      marketingHubOrganizationId: "org-1",
      organizationName: "Acme",
      accessToken: "opaque-access-token",
      expiresAt: "2026-11-01T00:00:00.000Z",
    });
    expect(mocks.exchangePairingCode).toHaveBeenCalledWith(expect.objectContaining({
      pairingCode: "PAIRING-CODE",
      requestedBy: { userId: "user-1", email: "operator@example.com" },
      serverCredential: "server-credential",
    }));
    expect(body).not.toHaveProperty("organization");
    expect(body).not.toHaveProperty("token");
  });

  it("rejects invalid payloads without calling the exchange service", async () => {
    const response = await POST(requestWith({ pairingCode: "" }));

    expect(response.status).toBe(400);
    expect(mocks.exchangePairingCode).not.toHaveBeenCalled();
  });

  it("rejects a missing server token before reading the body", async () => {
    const response = await POST(new Request("https://app.example.com/api/integrations/hcs/pairing/exchange", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(mocks.exchangePairingCode).not.toHaveBeenCalled();
  });

  it("maps credential failures to 401 without exposing the credential error", async () => {
    mocks.exchangePairingCode.mockRejectedValue(new Error("Invalid HCS pairing credential"));

    const response = await POST(requestWith({
      pairingCode: "PAIRING-CODE",
      hcsCompanyId: "company-1",
      hcsCompanyName: "HCS Acme",
      requestedBy: { userId: "user-1", email: "operator@example.com" },
    }, "wrong"));

    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("credential");
  });

  it("maps an unknown pairing code to 404 without logging or returning it", async () => {
    mocks.exchangePairingCode.mockRejectedValue(new Error("Invalid or expired pairing code"));
    const code = "SECRET-PAIRING-CODE";

    const response = await POST(requestWith({
      pairingCode: code,
      hcsCompanyId: "company-1",
      hcsCompanyName: "HCS Acme",
      requestedBy: { userId: "user-1", email: "operator@example.com" },
    }));

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(code);
  });
});
