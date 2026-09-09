import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { getLink } from "@/modules/links";
import { getRollupForLink, getRollupTotalsForLink } from "@/modules/analytics";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const link = await getLink(linkId);
  if (!link || link.organizationId !== user.profile.organizationId) {
    notFound();
  }

  const [rows, totals] = await Promise.all([
    getRollupForLink(linkId),
    getRollupTotalsForLink(linkId),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Analytics</h1>
        <p className="truncate text-sm text-muted-foreground">{link.destinationUrl}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Clicks (human)" value={totals.clicksHuman} />
        <Stat label="Clicks (bot)" value={totals.clicksBot} />
        <Stat label="Scans (human)" value={totals.scansHuman} />
        <Stat label="Scans (bot)" value={totals.scansBot} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Rolled up through yesterday — today&rsquo;s traffic finalizes on tomorrow&rsquo;s rollup run.
        </p>
        <a
          href={`/analytics/${linkId}/csv`}
          className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground"
        >
          Export CSV
        </a>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2">Date</th>
            <th className="py-2">Clicks (human)</th>
            <th className="py-2">Clicks (bot)</th>
            <th className="py-2">Scans (human)</th>
            <th className="py-2">Scans (bot)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-muted-foreground">
                No rolled-up data yet.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.date} className="border-b border-border">
              <td className="py-2">{row.date}</td>
              <td className="py-2">{row.clicksHuman}</td>
              <td className="py-2">{row.clicksBot}</td>
              <td className="py-2">{row.scansHuman}</td>
              <td className="py-2">{row.scansBot}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-2xl font-heading font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
