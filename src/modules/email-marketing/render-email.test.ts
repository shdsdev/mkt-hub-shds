import { describe, expect, it } from "vitest";
import { renderEmailHtml } from "./render-email";

describe("renderEmailHtml", () => {
  it("escapes text and renders personalization", () => {
    const html = renderEmailHtml(
      {
        version: 1,
        blocks: [
          { id: "text-1", type: "text", text: "<script>alert(1)</script>" },
          { id: "variable-1", type: "variable", name: "first_name", fallback: "friend" },
        ],
      },
      { first_name: "Ana & Luis" },
    );

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Ana &amp; Luis");
    expect(html).not.toContain("<script>");
  });

  it("does not render non-HTTPS image or button URLs", () => {
    const html = renderEmailHtml({
      version: 1,
      blocks: [
        { id: "image-1", type: "image", src: "javascript:alert(1)", alt: "Bad" },
        { id: "button-1", type: "button", label: "Bad", href: "http://example.com" },
      ],
    });

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("http://example.com");
  });
});
