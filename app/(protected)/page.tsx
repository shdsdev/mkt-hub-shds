import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { listLinks } from "@/modules/links";
import { listQrCodes } from "@/modules/qr";
import { listCampaigns } from "@/modules/campaigns";
import { getOrgTrafficLast30Days } from "@/modules/analytics";

export default async function OverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgId = user.profile.organizationId;
  const [links, qrCodes, campaigns, traffic30d] = await Promise.all([
    listLinks(orgId),
    listQrCodes(orgId),
    listCampaigns(orgId),
    getOrgTrafficLast30Days(orgId),
  ]);

  const activeLinks = links.filter((link) => link.status === "active").length;
  const activeQrCodes = qrCodes.filter((qr) => qr.status === "active").length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "active").length;

  const recentLinks = [...links]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Resumen</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · {user.profile.role}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Enlaces activos" value={activeLinks} />
        <Stat label="Códigos QR activos" value={activeQrCodes} />
        <Stat label="Campañas activas" value={activeCampaigns} />
        <Stat label="Clics + escaneos (30d)" value={traffic30d} />
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Enlaces recientes</p>
        {recentLinks.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay enlaces.</p>
        )}
        <ul className="space-y-1">
          {recentLinks.map((link) => (
            <li key={link.id}>
              <Link
                href={`/links/${link.id}`}
                className="block truncate rounded-md border border-border bg-card p-3 text-sm hover:border-primary"
              >
                {link.destinationUrl}
              </Link>
            </li>
          ))}
        </ul>
      </div>
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
