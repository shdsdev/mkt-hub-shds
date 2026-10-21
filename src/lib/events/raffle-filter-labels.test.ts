import { describe, expect, it } from "vitest";
import { getRaffleFilterLabel, getRaffleFilterOptions } from "./raffle-filter-labels";

describe("raffle filter labels", () => {
  it("translates stored option values without changing submitted values", () => {
    expect(getRaffleFilterLabel("occupation", "wholesaler")).toBe("Mayorista");
    expect(getRaffleFilterLabel("clientBrands", "bmighty")).toBe("BMighty");
    expect(getRaffleFilterLabel("interests", "wifi-automation")).toBe("Automatización por Wi-Fi");
    expect(getRaffleFilterLabel("occupation", "new-value")).toBe("new-value");
  });

  it("adds an explicit all option to every filter", () => {
    expect(getRaffleFilterOptions("occupation", ["wholesaler"])).toEqual([
      { value: "all", label: "Todas" },
      { value: "wholesaler", label: "Mayorista" },
    ]);
  });
});
