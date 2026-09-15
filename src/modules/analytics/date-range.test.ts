import { describe, expect, it } from "vitest";
import { utcDayBounds, previousPeriod, daysBetween } from "./date-range";

describe("utcDayBounds", () => {
  it("includes both selected calendar days", () => {
    const range = utcDayBounds({ from: "2026-09-01", to: "2026-09-30" });

    expect(range.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });
});

describe("previousPeriod", () => {
  it("returns an equal-length period ending the day before `from`", () => {
    expect(previousPeriod({ from: "2026-09-01", to: "2026-09-07" })).toEqual({
      from: "2026-08-25",
      to: "2026-08-31",
    });
  });

  it("handles a single-day range", () => {
    expect(previousPeriod({ from: "2026-09-15", to: "2026-09-15" })).toEqual({
      from: "2026-09-14",
      to: "2026-09-14",
    });
  });
});

describe("daysBetween", () => {
  it("is inclusive of both endpoints", () => {
    expect(daysBetween("2026-09-01", "2026-09-07")).toBe(7);
  });

  it("is 1 for a same-day range", () => {
    expect(daysBetween("2026-09-01", "2026-09-01")).toBe(1);
  });
});
