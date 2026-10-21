import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatSentryAlert, hasValidSentrySignature, normalizeSentryTags } from "./sentry-webhook";

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

  it("formats the documented issue-alert event payload", () => {
    const text = formatSentryAlert({
      action: "triggered",
      data: {
        event: {
          title: "Database timeout",
          level: "error",
          culprit: "events/register",
          tags: [["monitoring", "form_failure"], ["email", "private@example.com"]],
          web_url: "https://example-org.sentry.io/issues/123/events/456/",
        },
      },
      triggered_rule: "Form failures",
    });
    expect(text).toContain("[ERROR] Marketing HUB");
    expect(text).toContain("Database timeout");
    expect(text).toContain("Módulo: events/register");
    expect(text).toContain("https://example-org.sentry.io/issues/123/events/456/");
    expect(text).not.toContain("private@example.com");
  });

  it("normalizes valid tuple tags and ignores malformed entries", () => {
    expect(normalizeSentryTags([
      ["monitoring", "form_failure"],
      ["malformed"],
      { key: "legacy", value: "supported" },
      null,
    ])).toEqual({ monitoring: "form_failure", legacy: "supported" });
  });
});
