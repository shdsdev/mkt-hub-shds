import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  createPairingCode: vi.fn(),
  revokeHcsConnection: vi.fn(),
  renewHcsConnection: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/integrations", () => ({
  createPairingCode: mocks.createPairingCode,
  revokeHcsConnection: mocks.revokeHcsConnection,
  renewHcsConnection: mocks.renewHcsConnection,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  generateHcsPairingCodeAction,
  renewHcsConnectionAction,
  revokeHcsConnectionAction,
} from "./actions";

const admin = {
  id: "actor-1",
  email: "admin@example.com",
  profile: { id: "actor-1", organizationId: "org-1", role: "ADMIN", status: "active" },
};
const connectionId = "7a29aa2a-4e37-4b15-97a0-1aa6fef2f36d";

function formData(id = connectionId) {
  const data = new FormData();
  data.set("connectionId", id);
  return data;
}

describe("HCS integration settings actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(admin);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.createPairingCode.mockResolvedValue({
      row: { expiresAt: new Date("2026-10-16T12:15:00Z") },
      code: "PAIRING-CODE",
    });
    mocks.revokeHcsConnection.mockResolvedValue({ id: connectionId });
    mocks.renewHcsConnection.mockResolvedValue({
      connection: { id: connectionId, hcsCompanyName: "Acme", expiresAt: new Date("2027-01-14T00:00:00Z") },
      accessToken: "new-access-token",
    });
  });

  it("denies inactive or non-admin users before calling integration services", async () => {
    mocks.isActive.mockReturnValue(false);

    await expect(generateHcsPairingCodeAction({})).resolves.toEqual({
      error: "No tienes permiso para administrar integraciones.",
    });
    expect(mocks.createPairingCode).not.toHaveBeenCalled();
  });

  it("generates an organization-scoped pairing code and returns it once", async () => {
    const result = await generateHcsPairingCodeAction({});

    expect(result).toMatchObject({ pairingCode: "PAIRING-CODE" });
    expect(mocks.createPairingCode).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", expiresAt: expect.any(Date) }),
    );
  });

  it("revokes only the current organization connection", async () => {
    const result = await revokeHcsConnectionAction({}, formData());

    expect(result).toEqual({ success: "Conexión revocada." });
    expect(mocks.revokeHcsConnection).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", connectionId }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/integrations");
  });

  it("renews a connection and returns the new token only in the immediate response", async () => {
    const result = await renewHcsConnectionAction({}, formData());

    expect(result).toMatchObject({ accessToken: "new-access-token", connectionId });
    expect(mocks.renewHcsConnection).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", connectionId, expiresAt: expect.any(Date) }),
    );
    expect(JSON.stringify(mocks.renewHcsConnection.mock.calls[0][0])).not.toContain("new-access-token");
  });
});
