import { describe, expect, it } from "vitest";
import { formatAnalyticsCsv } from "./csv";

describe("formatAnalyticsCsv", () => {
  it("exports QR data without link-click columns", () => {
    expect(formatAnalyticsCsv("scans_human", [{ bucket: "2026-09-01", count: 5 }])).toBe(
      "date,scans_human\n2026-09-01,5\n",
    );
  });

  it("exports Link data without QR-scan columns", () => {
    expect(formatAnalyticsCsv("clicks_human", [{ bucket: "2026-09-01", count: 10 }])).toBe(
      "date,clicks_human\n2026-09-01,10\n",
    );
  });
});
