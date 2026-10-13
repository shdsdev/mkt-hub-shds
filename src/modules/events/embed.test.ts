import { describe, expect, it } from "vitest";
import { getEventEmbedSnippet, getEventEmbedUrl } from "./embed";

describe("event embed helpers", () => {
  it("builds the public embed URL without a duplicate slash", () => {
    expect(getEventEmbedUrl("https://hub.example.com/", "workshop-mayo")).toBe(
      "https://hub.example.com/events/embed/workshop-mayo",
    );
  });

  it("builds a copyable iframe snippet with safe defaults", () => {
    expect(getEventEmbedSnippet("https://hub.example.com", "workshop-mayo")).toBe(
      `<iframe src="https://hub.example.com/events/embed/workshop-mayo" style="width:100%;min-height:760px;border:0" loading="lazy" title="Formulario de registro"></iframe>`,
    );
  });

  it("encodes a slug before placing it in the URL", () => {
    expect(getEventEmbedUrl("https://hub.example.com", "workshop mayo")).toBe(
      "https://hub.example.com/events/embed/workshop%20mayo",
    );
  });
});
