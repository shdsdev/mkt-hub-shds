import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatSentryAlert, hasValidSentrySignature } from "./sentry-webhook";

describe("Sentry webhook", () => {
  it("validates the raw request signature", () => {
    const body = JSON.stringify({ action: "created" });
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    expect(hasValidSentrySignature(body, signature, "secret")).toBe(true);
    expect(hasValidSentrySignature(body, signature, "wrong")).toBe(false);
  });

  it("formats a compact alert without exposing unrelated payload data", () => {
    const text = formatSentryAlert({
      action: "created",
      data: { issue: { title: "Database timeout", level: "fatal", count: "4", userCount: 2, culprit: "events/register", permalink: "https://sentry.io/issues/1" } },
    });
    expect(text).toContain("[FATAL] Marketing HUB");
    expect(text).toContain("Ocurrencias: 4");
    expect(text).not.toContain("email");
  });
});
