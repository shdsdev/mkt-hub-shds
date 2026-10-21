import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
import {
  getMonitoringAlertType,
  isMonitoringAlertEnabled,
  type MonitoringSettings,
} from "./service";

const settings: MonitoringSettings = {
  id: "global",
  enabled: true,
  telegramChatId: "-100123",
  formAlertsEnabled: true,
  performanceAlertsEnabled: true,
  slowOperationMs: 1500,
  updatedAt: new Date(),
};

describe("monitoring alert classification", () => {
  it("classifies Sentry issue payloads as form failures when tagged accordingly", () => {
    expect(getMonitoringAlertType({ data: { issue: { tags: [{ key: "monitoring", value: "form_failure" }] } } })).toBe("form_failure");
  });

  it("classifies documented issue-alert event tuple tags", () => {
    expect(getMonitoringAlertType({ data: { event: { tags: [["monitoring", "form_failure"]] } } })).toBe("form_failure");
  });

  it("classifies slow transaction payloads as performance alerts", () => {
    expect(getMonitoringAlertType({ data: { transaction: { duration: 2200 } } }, 1500)).toBe("performance");
  });

  it("honors the global enable and alert-specific flags", () => {
    expect(isMonitoringAlertEnabled(settings, "form_failure")).toBe(true);
    expect(isMonitoringAlertEnabled(settings, "performance")).toBe(true);
    expect(isMonitoringAlertEnabled({ ...settings, enabled: false }, "form_failure")).toBe(false);
    expect(isMonitoringAlertEnabled({ ...settings, performanceAlertsEnabled: false }, "performance")).toBe(false);
  });
});
