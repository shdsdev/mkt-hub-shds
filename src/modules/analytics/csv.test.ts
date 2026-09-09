import { describe, it, expect } from "vitest";
import { formatRollupCsv, type RollupRow } from "./csv";

describe("formatRollupCsv", () => {
  it("produces a header row and one data row per input", () => {
    const rows: RollupRow[] = [
      { date: "2026-09-01", clicksHuman: 10, clicksBot: 2, scansHuman: 5, scansBot: 1 },
    ];
    const csv = formatRollupCsv(rows);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("date,clicks_human,clicks_bot,scans_human,scans_bot");
    expect(lines[1]).toBe("2026-09-01,10,2,5,1");
    expect(lines).toHaveLength(2);
  });

  it("returns just the header for an empty input", () => {
    const csv = formatRollupCsv([]);
    expect(csv.trim()).toBe("date,clicks_human,clicks_bot,scans_human,scans_bot");
  });

  it("preserves row order (assumed already sorted by the caller)", () => {
    const rows: RollupRow[] = [
      { date: "2026-09-02", clicksHuman: 1, clicksBot: 0, scansHuman: 0, scansBot: 0 },
      { date: "2026-09-01", clicksHuman: 2, clicksBot: 0, scansHuman: 0, scansBot: 0 },
    ];
    const lines = formatRollupCsv(rows).trim().split("\n");
    expect(lines[1]).toContain("2026-09-02");
    expect(lines[2]).toContain("2026-09-01");
  });
});
