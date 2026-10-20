import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  createPairingCode: vi.fn(),
  revokeHcsConnection: vi.fn(),
  renewHcsConnection: vi.fn(),
  getTelegramSettings: vi.fn(),
  upsertTelegramSettings: vi.fn(),
  sendTelegramMessage: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/integrations", () => ({
  createPairingCode: mocks.createPairingCode,
  revokeHcsConnection: mocks.revokeHcsConnection,
  renewHcsConnection: mocks.renewHcsConnection,
}));
vi.mock("@/modules/notifications", () => ({
  getTelegramSettings: mocks.getTelegramSettings,
  upsertTelegramSettings: mocks.upsertTelegramSettings,
  sendTelegramMessage: mocks.sendTelegramMessage,
  validateTelegramTemplate: vi.fn(() => undefined),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/env", () => ({
  env: {
    HCS_PAIRING_EXPIRY_MINUTES: 15,
    HCS_CONNECTION_EXPIRY_DAYS: 90,
    TELEGRAM_BOT_TOKEN: "test-bot-token",
  },
}));

import {
  generateHcsPairingCodeAction,
  renewHcsConnectionAction,
  revokeHcsConnectionAction,
  saveTelegramSettingsAction,
  sendTelegramTestMessageAction,
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
    mocks.getTelegramSettings.mockResolvedValue({ enabled: true, chatId: "-100123" });
    mocks.upsertTelegramSettings.mockResolvedValue({ enabled: true, chatId: "-100123" });
    mocks.sendTelegramMessage.mockResolvedValue(undefined);
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

  it("saves organization-scoped Telegram settings", async () => {
    const data = new FormData();
    data.set("chatId", "-100987");
    data.set("enabled", "on");

    await expect(saveTelegramSettingsAction({}, data)).resolves.toEqual({
      success: "Configuración de Telegram guardada.",
    });
    expect(mocks.upsertTelegramSettings).toHaveBeenCalledWith({
      organizationId: "org-1",
      chatId: "-100987",
      enabled: true,
      messageTemplate: null,
    });
  });

  it("sends a Telegram test only when the organization setting is active", async () => {
    await expect(sendTelegramTestMessageAction({})).resolves.toEqual({
      success: "Mensaje de prueba enviado correctamente.",
    });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: "-100123" }));

    mocks.getTelegramSettings.mockResolvedValue({ enabled: false, chatId: "-100123" });
    await expect(sendTelegramTestMessageAction({})).resolves.toEqual({
      error: "Activá Telegram y configurá un chat ID antes de enviar una prueba.",
    });
  });
});
