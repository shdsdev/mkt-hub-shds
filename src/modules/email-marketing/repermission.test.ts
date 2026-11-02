import { describe, expect, it } from "vitest";
import { createRepermissionToken, hashRepermissionToken, isRepermissionContactEligible, renderRepermissionEmailHtml } from "./repermission";

describe("email re-permission", () => {
  it("creates opaque tokens that can be matched only by their hash", () => {
    const first = createRepermissionToken();
    const second = createRepermissionToken();

    expect(first).not.toBe(second);
    expect(hashRepermissionToken(first)).toHaveLength(64);
    expect(hashRepermissionToken(first)).toBe(hashRepermissionToken(first));
    expect(hashRepermissionToken(first)).not.toBe(hashRepermissionToken(second));
  });

  it("only allows pending contacts to receive a re-permission request", () => {
    expect(isRepermissionContactEligible("pending")).toBe(true);
    expect(isRepermissionContactEligible("subscribed")).toBe(false);
    expect(isRepermissionContactEligible("unsubscribed")).toBe(false);
    expect(isRepermissionContactEligible("suppressed")).toBe(false);
  });

  it("escapes recipient data and includes both preference actions", () => {
    const html = renderRepermissionEmailHtml({
      recipientName: "A <B>",
      confirmUrl: "https://example.com/confirm?a=1&b=2",
      declineUrl: "https://example.com/decline",
      logoUrl: "https://example.com/logos/shades-de-mexico-white.png",
    });

    expect(html).toContain("A &lt;B&gt;");
    expect(html).toContain("https://example.com/confirm?a=1&amp;b=2");
    expect(html).toContain("https://example.com/decline");
    expect(html).toContain("https://example.com/logos/shades-de-mexico-white.png");
    expect(html).toContain("alt=\"Shades de México\"");
    expect(html).not.toContain("A <B>");
  });
});
