import { describe, it, expect } from "vitest";
import { isValidSlug, generateSlug, SLUG_LENGTH } from "./slug";

describe("isValidSlug", () => {
  it("accepts a slug within the allowed charset and length", () => {
    expect(isValidSlug("abc123")).toBe(true);
    expect(isValidSlug("abc-123_XYZ")).toBe(true);
  });

  it("rejects a slug shorter than 3 characters", () => {
    expect(isValidSlug("ab")).toBe(false);
  });

  it("rejects a slug longer than 64 characters", () => {
    expect(isValidSlug("a".repeat(65))).toBe(false);
  });

  it("rejects characters outside [A-Za-z0-9_-]", () => {
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("has/slash")).toBe(false);
    expect(isValidSlug("has.dot")).toBe(false);
  });
});

describe("generateSlug", () => {
  it("produces a slug of the expected length that passes isValidSlug", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(SLUG_LENGTH);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("does not use visually ambiguous characters (0/O, 1/l/I)", () => {
    const slug = generateSlug();
    expect(slug).not.toMatch(/[0O1lI]/);
  });

  it("generates different slugs across calls (not a constant)", () => {
    const slugs = new Set(Array.from({ length: 20 }, () => generateSlug()));
    expect(slugs.size).toBeGreaterThan(1);
  });
});
