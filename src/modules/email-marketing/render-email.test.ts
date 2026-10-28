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

  it("preserves complete email documents and their safe style blocks", () => {
    const html = renderEmailHtml({
      version: 1,
      mode: "html",
      bodyHtml: '<!doctype html><html><head><style>.hero{background:#15434a;letter-spacing:2px} @import url("https://evil.example/style.css");</style></head><body><table class="hero" style="border-collapse:collapse;max-width:600px"><tr><td>Campaign</td></tr></table></body></html>',
    });

    expect(html).toContain(".hero");
    expect(html).toContain("background:#15434a");
    expect(html).toContain("border-collapse: collapse");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("evil.example/style.css");
    expect(html).not.toContain("<main");
  });

  it("inlines safe class styles for complete email documents", () => {
    const html = renderEmailHtml({
      version: 1,
      mode: "html",
      bodyHtml: '<!doctype html><html><head><style>.hero{background:#15434a;color:#fff;padding:24px}</style></head><body><table class="hero"><tr><td>Campaign</td></tr></table></body></html>',
    });

    expect(html).toMatch(/style="[^\"]*background: #15434a;[^\"]*color: #fff;[^\"]*padding: 24px;/);
  });

  it("keeps zero-based spacing values used by email layouts", () => {
    const html = renderEmailHtml({
      version: 1,
      mode: "html",
      bodyHtml: '<!doctype html><html><head><style>.section{margin:0;padding:0 24px 32px;line-height:1.4}</style></head><body><div class="section">Campaign</div></body></html>',
    });

    expect(html).toMatch(/style="[^\"]*margin: 0;[^\"]*padding: 0 24px 32px;[^\"]*line-height: 1.4;/);
  });

  it("keeps zero-based spacing values already present inline", () => {
    const html = renderEmailHtml({
      version: 1,
      mode: "html",
      bodyHtml: '<!doctype html><html><body><div style="margin:0;padding:0 24px 32px;line-height:1.4">Campaign</div></body></html>',
    });

    expect(html).toMatch(/style="[^\"]*margin:0;[^\"]*padding:0 24px 32px;[^\"]*line-height:1.4/);
  });

  it("keeps safe font shorthand from email templates", () => {
    const html = renderEmailHtml({
      version: 1,
      mode: "html",
      bodyHtml: '<!doctype html><html><body><div style="font:500 33px/1.13 &quot;Space Grotesk&quot;,Arial,Helvetica,sans-serif">Headline</div></body></html>',
    });

    expect(html).toContain('font:500 33px/1.13 &quot;Space Grotesk&quot;,Arial,Helvetica,sans-serif');
  });

  it("ignores pasted characters before the HTML document", () => {
    const html = renderEmailHtml({
      version: 1,
      mode: "html",
      bodyHtml: "44M<!doctype html><html><body><p>Campaign</p></body></html>",
    });

    expect(html).not.toContain("44M");
    expect(html).toContain("<p>Campaign</p>");
  });

  it("preserves email image sources and directional spacing", () => {
    const html = renderEmailHtml({
      version: 1,
      mode: "html",
      bodyHtml: '<!doctype html><html><body><img src="https://cdn.example.com/logo.png" style="display:block;padding-top:24px;padding-bottom:16px;margin-top:12px;margin-bottom:8px" /></body></html>',
    });

    expect(html).toContain('src="https://cdn.example.com/logo.png"');
    expect(html).toContain("padding-top:24px");
    expect(html).toContain("padding-bottom:16px");
    expect(html).toContain("margin-top:12px");
    expect(html).toContain("margin-bottom:8px");
  });

  it("removes inline event handlers and unsafe protocols", () => {
    const html = sanitizeEmailBodyHtml('<p onclick="alert(1)">Text</p><img src="data:text/html,bad" onerror="alert(1)" />');

    expect(html).toBe("<p>Text</p><img />");
  });
});
