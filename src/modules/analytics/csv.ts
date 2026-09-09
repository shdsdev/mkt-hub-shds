export type RollupRow = {
  date: string;
  clicksHuman: number;
  clicksBot: number;
  scansHuman: number;
  scansBot: number;
};

const HEADER = "date,clicks_human,clicks_bot,scans_human,scans_bot";

export function formatRollupCsv(rows: RollupRow[]): string {
  const lines = rows.map(
    (row) => `${row.date},${row.clicksHuman},${row.clicksBot},${row.scansHuman},${row.scansBot}`,
  );
  return [HEADER, ...lines].join("\n") + "\n";
}
