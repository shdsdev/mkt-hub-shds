import { describe, it, expect } from "vitest";
import {
  SOURCE_OPTIONS,
  MEDIUM_OPTIONS,
  getActiveTaxonomyOptions,
  getDeprecatedTaxonomyOptions,
  searchTaxonomyOptions,
  findActiveTaxonomyOption,
  getRecommendedMediumsForSource,
} from "./taxonomy";

describe("taxonomy catalogs", () => {
  it("excludes deprecated values from active options", () => {
    const active = getActiveTaxonomyOptions(SOURCE_OPTIONS);
    expect(active.some((option) => option.status === "deprecated")).toBe(false);
    expect(active.some((option) => option.value === "facebook-ads")).toBe(false);
  });

  it("exposes deprecated values separately for historical display", () => {
    const deprecated = getDeprecatedTaxonomyOptions(SOURCE_OPTIONS);
    expect(deprecated.map((option) => option.value)).toContain("facebook-ads");
    expect(deprecated.every((option) => option.status === "deprecated")).toBe(true);
  });

  it("searches by value, label, and alias case-insensitively", () => {
    expect(searchTaxonomyOptions(SOURCE_OPTIONS, "google").map((option) => option.value)).toEqual([
      "google",
    ]);
    expect(searchTaxonomyOptions(SOURCE_OPTIONS, "ADS").some((option) => option.value === "google")).toBe(
      true,
    );
    expect(searchTaxonomyOptions(SOURCE_OPTIONS, "fb").some((option) => option.value === "facebook")).toBe(
      true,
    );
  });

  it("does not surface deprecated values through search", () => {
    const results = searchTaxonomyOptions(SOURCE_OPTIONS, "facebook");
    expect(results.some((option) => option.value === "facebook-ads")).toBe(false);
    expect(results.some((option) => option.value === "facebook")).toBe(true);
  });

  it("finds only active options by canonical value", () => {
    expect(findActiveTaxonomyOption(SOURCE_OPTIONS, "facebook")?.value).toBe("facebook");
    expect(findActiveTaxonomyOption(SOURCE_OPTIONS, "facebook-ads")).toBeUndefined();
  });

  it("returns recommended mediums for a source", () => {
    expect(getRecommendedMediumsForSource("google")).toContain("cpc");
    expect(getRecommendedMediumsForSource("unknown-source")).toEqual([]);
  });

  it("treats every active medium value as an approved medium choice", () => {
    expect(MEDIUM_OPTIONS.length).toBeGreaterThan(0);
    expect(getActiveTaxonomyOptions(MEDIUM_OPTIONS).every((option) => option.status === "active")).toBe(
      true,
    );
  });
});
