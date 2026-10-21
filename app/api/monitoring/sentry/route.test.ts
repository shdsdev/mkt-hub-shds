import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMonitoringSettings: vi.fn(),
  sendTelegramMessage: vi.fn(),
  hasValidSentrySignature: vi.fn(),
}));

vi.mock("@/modules/monitoring", () => ({
  getMonitoringSettings: mocks.getMonitoringSettings,
  hasValidSentrySignature: mocks.hasValidSentrySignature,
  formatSentryAlert: (payload: { data?: { issue?: { title?: string } } }) => payload.data?.issue?.title ?? "alert",
  getMonitoringAlertType: () => "form_failure",
  isMonitoringAlertEnabled: () => true,
}));
vi.mock("@/modules/notifications", () => ({ sendTelegramMessage: mocks.sendTelegramMessage }));
vi.mock("@/lib/env", () => ({ env: { SENTRY_ALERTS_CLIENT_SECRET: "hook-secret", TELEGRAM_BOT_TOKEN: "bot-token" } }));

import { POST } from "./route";

const settings = {
  enabled: true,
  formFailuresEnabled: true,
  performanceAlertsEnabled: true,
  telegramChatId: "-100123",
  slowOperationMs: 1500,
};

function signedRequest(payload: object, secret = "hook-secret") {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return new Request("http://localhost/api/monitoring/sentry", {
    method: "POST",
    headers: { "content-type": "application/json", "sentry-hook-signature": signature },
    body,
  });
}

describe("POST /api/monitoring/sentry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getMonitoringSettings.mockResolvedValue(settings);
    mocks.sendTelegramMessage.mockResolvedValue(undefined);
    mocks.hasValidSentrySignature.mockReturnValue(true);
  });

  it("rejects invalid signatures without sending or exposing secrets", async () => {
    mocks.hasValidSentrySignature.mockReturnValue(false);
    const invalidResponse = await POST(signedRequest({ action: "issue", data: {} }));
    expect(invalidResponse.status).toBe(401);
    expect(await invalidResponse.json()).toEqual({ error: "Invalid signature" });
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads", async () => {
    const body = "not-json";
    const signature = createHmac("sha256", "hook-secret").update(body).digest("hex");
    const response = await POST(new Request("http://localhost/api/monitoring/sentry", {
      method: "POST",
      headers: { "sentry-hook-signature": signature },
      body,
    }));
    expect(response.status).toBe(400);
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("sends a safe operational alert for a valid enabled issue", async () => {
    const response = await POST(signedRequest({ action: "issue", data: { issue: { title: "Database timeout", tags: { monitoring: "form_failure" } } } }));
    expect(response.status).toBe(202);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(expect.objectContaining({
      token: "bot-token",
      chatId: "-100123",
      text: expect.stringContaining("Database timeout"),
    }));
  });

  it("rejects safely when monitoring is disabled", async () => {
    mocks.getMonitoringSettings.mockResolvedValue({ ...settings, enabled: false });
    const response = await POST(signedRequest({ action: "issue", data: { issue: { title: "Hidden" } } }));
    expect(response.status).toBe(404);
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });
});
