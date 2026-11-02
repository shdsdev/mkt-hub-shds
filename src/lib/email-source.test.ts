import { describe, expect, it } from "vitest";
import { createEmailPreviewDocument, extractEmailBodyHtml, getEmailPreviewWidth } from "./email-source";

describe("email source helpers", () => {
  it("extracts the body from a complete HTML document", () => {
    expect(
      extractEmailBodyHtml("<!doctype html><html><head><style>p{color:red}</style></head><body><p>Hello</p></body></html>"),
    ).toBe("<p>Hello</p>");
  });

  it("keeps HTML fragments unchanged", () => {
    expect(extractEmailBodyHtml("<p>Hello</p><a href=\"https://example.com\">Open</a>")).toBe(
      "<p>Hello</p><a href=\"https://example.com\">Open</a>",
    );
  });

  it("does not wrap a complete document in another email shell", () => {
    const source = "<!doctype html><html><body><p>Hello</p></body></html>";

    expect(createEmailPreviewDocument(source)).toBe(source);
    expect(createEmailPreviewDocument("<p>Hello</p>")).toContain("<body");
  });

  it("uses the responsive preview width selected by the editor", () => {
    expect(getEmailPreviewWidth("desktop")).toBe("100%");
    expect(getEmailPreviewWidth("mobile")).toBe(390);
  });
});
