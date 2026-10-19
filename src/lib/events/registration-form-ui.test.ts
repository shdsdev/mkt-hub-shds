import { describe, expect, it } from "vitest";
import { getPublicClientBrandOptions } from "./registration-form-ui";

describe("getPublicClientBrandOptions", () => {
  it("adds Ninguna for the public form without exposing it as an admin option", () => {
    expect(getPublicClientBrandOptions(["shades", "bmighty"])).toEqual(["none", "shades", "bmighty"]);
  });

  it("does not duplicate Ninguna when reading legacy configuration", () => {
    expect(getPublicClientBrandOptions(["none", "drapery"])).toEqual(["none", "drapery"]);
  });
});
