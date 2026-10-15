import { describe, expect, it } from "vitest";
import { AURA_HAS_GRAIN, AURA_LAYER_COUNT } from "./aura-background";

// This codebase has no React-rendering test infrastructure (no @testing-library/react dependency
// anywhere), so this asserts against the same data tables AuraBackground renders from rather than
// introducing new test tooling for one component.
describe("aura-background", () => {
  it("renders arctic-frost with 4 layers, per its Aura Gradient spec", () => {
    expect(AURA_LAYER_COUNT["arctic-frost"]).toBe(4);
  });

  it("renders arctic-frost with the grain overlay", () => {
    expect(AURA_HAS_GRAIN["arctic-frost"]).toBe(true);
  });
});
