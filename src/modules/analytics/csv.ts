export type AnalyticsCsvRow = { bucket: string; count: number };

export function formatAnalyticsCsv(
  column: "scans_human" | "clicks_human",
  rows: AnalyticsCsvRow[],
): string {
  return [`date,${column}`, ...rows.map((row) => `${row.bucket},${row.count}`)].join("\n") + "\n";
}
