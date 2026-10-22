import { describe, expect, it } from "vitest";
import { parseEmailCampaignContent, parseEmailContentDocument } from "./content-schema";

describe("email content document", () => {
  it("accepts the MVP block types", () => {
    expect(
      parseEmailContentDocument({
        version: 1,
        blocks: [
          { id: "text-1", type: "text", text: "Hello" },
          { id: "image-1", type: "image", src: "https://example.com/image.png", alt: "Hero" },
          { id: "button-1", type: "button", label: "Open", href: "https://example.com" },
          { id: "divider-1", type: "divider" },
          { id: "columns-1", type: "columns", columns: ["One", "Two"] },
          { id: "variable-1", type: "variable", name: "first_name" },
        ],
      }).blocks,
    ).toHaveLength(6);
  });

  it("accepts an HTML document and normalizes legacy block documents", () => {
    expect(parseEmailCampaignContent({ version: 1, mode: "html", bodyHtml: "<p>Hello</p>" })).toEqual({
      version: 1,
      mode: "html",
      bodyHtml: "<p>Hello</p>",
    });
    expect(parseEmailContentDocument({ version: 1, blocks: [] }).mode).toBe("blocks");
  });

  it("rejects unsupported block types", () => {
    expect(() =>
      parseEmailContentDocument({
        version: 1,
        blocks: [{ id: "html-1", type: "raw_html", html: "<script>" }],
      }),
    ).toThrow();
  });
});
