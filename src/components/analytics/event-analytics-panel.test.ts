import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panelSource = readFileSync(new URL("./event-analytics-panel.tsx", import.meta.url), "utf8");

describe("EventAnalyticsPanel chart renderer", () => {
  it("renders shared bucket data with a line chart instead of bars", () => {
    expect(panelSource).toContain("LineChart");
    expect(panelSource).toContain("<LineChart data={data.buckets}>");
    expect(panelSource).toMatch(/<Line\b[\s\S]*?dataKey="count"[\s\S]*?name=\{pluralLabel\}/);
    expect(panelSource).not.toMatch(/\b(?:Bar|BarChart)\b/);
  });
});
