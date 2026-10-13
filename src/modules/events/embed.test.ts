import { describe, expect, it } from "vitest";
import { getEventEmbedSnippet, getEventEmbedUrl } from "./embed";

describe("event embed helpers", () => {
  it("builds the public embed URL without a duplicate slash", () => {
    expect(getEventEmbedUrl("https://hub.example.com/", "workshop-mayo")).toBe(
      "https://hub.example.com/events/embed/workshop-mayo",
    );
  });

  it("builds a copyable iframe snippet with safe defaults", () => {
    const snippet = getEventEmbedSnippet("https://hub.example.com", "workshop-mayo");
    expect(snippet).toContain("data-event-registration-embed");
    expect(snippet).toContain("https://hub.example.com/events/embed/workshop-mayo");
    expect(snippet).toContain("event-registration:resize");
    expect(snippet).toContain("event.source!==frame.contentWindow");
  });

  it("encodes a slug before placing it in the URL", () => {
    expect(getEventEmbedUrl("https://hub.example.com", "workshop mayo")).toBe(
      "https://hub.example.com/events/embed/workshop%20mayo",
    );
  });
});
