import { describe, expect, it } from "vitest";
import { renderEmailHtml, sanitizeEmailBodyHtml } from "./render-email";

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

  it("sanitizes HTML mode while preserving safe inline email markup", () => {
    const html = renderEmailHtml(
      {
        version: 1,
        mode: "html",
        bodyHtml: '<p style="color:#ff6f2c">Hi {{first_name}}</p><script>alert(1)</script><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">bad</a>',
      },
      { first_name: "Ana & Luis" },
    );

    expect(html).toContain('<p style="color:#ff6f2c">Hi Ana &amp; Luis</p>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("unsubscribe_url");
  });

  it("removes inline event handlers and unsafe protocols", () => {
    const html = sanitizeEmailBodyHtml('<p onclick="alert(1)">Text</p><img src="data:text/html,bad" onerror="alert(1)" />');

    expect(html).toBe("<p>Text</p><img />");
  });
});
