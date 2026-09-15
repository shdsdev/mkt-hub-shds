import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BinaryLoader } from "./binary-loader";

describe("BinaryLoader", () => {
  it("renders an inline element for use inside text content", () => {
    expect(renderToStaticMarkup(<BinaryLoader />)).toBe('<span class="ld-binary"></span>');
  });
});
