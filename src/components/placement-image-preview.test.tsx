import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlacementImagePreview } from "./placement-image-preview";

describe("PlacementImagePreview", () => {
  it("renders an accessible preview trigger", () => {
    const markup = renderToStaticMarkup(
      <PlacementImagePreview src="https://example.com/reference.jpg" />,
    );

    expect(markup).toContain('aria-label="Ver imagen de referencia"');
    expect(markup).toContain("Ver imagen");
  });
});
