import { describe, expect, it } from "vitest";
import { formatRegistrationDate } from "./registration-date";

describe("formatRegistrationDate", () => {
  it("uses a stable Spanish date and 24-hour time format", () => {
    expect(formatRegistrationDate(new Date("2026-10-13T17:44:26.000Z"))).toBe("13/10/2026, 11:44:26");
  });
});
