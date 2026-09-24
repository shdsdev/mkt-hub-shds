import { describe, it, expect } from "vitest";
import { utmPresets, utmTemplateStatus } from "./db";

// Schema-level contract for the additive 0016 migration: legacy rows keep their exact UTM bytes
// and gain safe defaults (active + empty custom pairs), while provenance/metadata stay nullable.
describe("utm_presets schema (additive migration contract)", () => {
  it("defaults new rows to active with a non-null empty custom-pairs array", () => {
    expect(utmPresets.status.notNull).toBe(true);
    expect(utmPresets.status.default).toBe("active");
    expect(utmPresets.customParameters.notNull).toBe(true);
    expect(utmPresets.customParameters.hasDefault).toBe(true);
  });

  it("keeps description, utm_id, and creator nullable for legacy rows", () => {
    expect(utmPresets.description.notNull).toBe(false);
    expect(utmPresets.utmId.notNull).toBe(false);
    expect(utmPresets.createdBy.notNull).toBe(false);
  });

  it("adds a non-null updated_at timestamp", () => {
    expect(utmPresets.updatedAt.notNull).toBe(true);
    expect(utmPresets.updatedAt.hasDefault).toBe(true);
  });

  it("supports the active/draft/archived lifecycle", () => {
    expect(utmTemplateStatus.enumValues).toEqual(["active", "draft", "archived"]);
  });
});
