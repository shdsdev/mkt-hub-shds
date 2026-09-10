import { describe, it, expect } from "vitest";
import { buildHeatmapWeeks } from "./heatmap";

describe("buildHeatmapWeeks", () => {
  it("builds the requested number of weeks, each with 7 days, ending today", () => {
    const today = new Date("2026-09-10T00:00:00Z");
    const weeks = buildHeatmapWeeks(new Map(), 2, today);

    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[1]).toHaveLength(7);
    expect(weeks[0][0].date).toBe("2026-08-28");
    expect(weeks[1][6].date).toBe("2026-09-10");
  });

  it("assigns count 0 and level 0 for days with no data", () => {
    const today = new Date("2026-09-10T00:00:00Z");
    const weeks = buildHeatmapWeeks(new Map(), 1, today);

    for (const cell of weeks[0]) {
      expect(cell.count).toBe(0);
      expect(cell.level).toBe(0);
    }
  });

  it("scales levels 1-4 relative to the highest count in the window", () => {
    const today = new Date("2026-09-10T00:00:00Z");
    const counts = new Map([
      ["2026-09-10", 8], // max -> level 4
      ["2026-09-09", 6], // 6/8 -> level 3
      ["2026-09-08", 4], // 4/8 -> level 2
      ["2026-09-07", 2], // 2/8 -> level 1
      ["2026-09-06", 0], // level 0
    ]);
    const weeks = buildHeatmapWeeks(counts, 1, today);
    const byDate = Object.fromEntries(weeks[0].map((cell) => [cell.date, cell]));

    expect(byDate["2026-09-10"].level).toBe(4);
    expect(byDate["2026-09-09"].level).toBe(3);
    expect(byDate["2026-09-08"].level).toBe(2);
    expect(byDate["2026-09-07"].level).toBe(1);
    expect(byDate["2026-09-06"].level).toBe(0);
  });

  it("does not divide by zero when every count is zero", () => {
    const today = new Date("2026-09-10T00:00:00Z");
    const counts = new Map([["2026-09-10", 0]]);
    const weeks = buildHeatmapWeeks(counts, 1, today);

    expect(weeks[0].every((cell) => cell.level === 0)).toBe(true);
  });
});
