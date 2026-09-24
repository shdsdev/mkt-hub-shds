import { describe, it, expect } from "vitest";
import { links } from "./db";

describe("links schema — utm_id addition", () => {
  it("adds a nullable utm_id without changing the existing UTM columns", () => {
    expect(links.utmId.notNull).toBe(false);
    expect(links.utmSource.notNull).toBe(false);
    expect(links.utmMedium.notNull).toBe(false);
    expect(links.utmCampaign.notNull).toBe(false);
  });
});
