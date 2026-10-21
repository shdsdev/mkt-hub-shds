import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  getMonitoringSettings: vi.fn(),
  upsertMonitoringSettings: vi.fn(),
  sendTelegramMessage: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/monitoring", () => ({
  getMonitoringSettings: mocks.getMonitoringSettings,
  upsertMonitoringSettings: mocks.upsertMonitoringSettings,
}));
vi.mock("@/modules/notifications", () => ({ sendTelegramMessage: mocks.sendTelegramMessage }));
vi.mock("@/lib/env", () => ({ env: { TELEGRAM_BOT_TOKEN: "bot-token" } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveMonitoringSettingsAction, sendMonitoringTestAction } from "./actions";

const admin = {
  id: "admin-1",
  email: "admin@example.com",
  profile: { id: "admin-1", organizationId: "org-1", role: "ADMIN", status: "active" },
};

function settingsForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("enabled", "on");
  form.set("telegramChatId", "-100123");
  form.set("formAlertsEnabled", "on");
  form.set("performanceAlertsEnabled", "on");
  form.set("slowOperationMs", "1500");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

describe("monitoring settings actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(admin);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getMonitoringSettings.mockResolvedValue({ telegramChatId: "-100123" });
    mocks.sendTelegramMessage.mockResolvedValue(undefined);
  });

  it("rejects non-admins before persistence", async () => {
    mocks.isAdmin.mockReturnValue(false);
    await expect(saveMonitoringSettingsAction({}, settingsForm())).resolves.toEqual({
      error: "No tienes permiso para administrar el monitoreo.",
    });
    expect(mocks.upsertMonitoringSettings).not.toHaveBeenCalled();
  });

  it("validates the chat before saving an enabled configuration", async () => {
    await expect(saveMonitoringSettingsAction({}, settingsForm({ telegramChatId: "" }))).resolves.toEqual({
      error: "Ingresá un chat ID para activar las alertas.",
    });
  });

  it("saves the global configuration and can send a test alert", async () => {
    await expect(saveMonitoringSettingsAction({}, settingsForm())).resolves.toEqual({
      success: "Configuración de monitoreo guardada.",
    });
    expect(mocks.upsertMonitoringSettings).toHaveBeenCalledWith(expect.objectContaining({
      telegramChatId: "-100123",
      slowOperationMs: 1500,
    }));
    await expect(sendMonitoringTestAction({})).resolves.toEqual({
      success: "Alerta de prueba enviada correctamente.",
    });
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(expect.objectContaining({ token: "bot-token", chatId: "-100123" }));
  });
});
