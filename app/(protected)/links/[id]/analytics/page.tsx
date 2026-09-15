import { notFound } from "next/navigation";
import { EventAnalyticsPanel } from "@/components/analytics/event-analytics-panel";
import { getCurrentUser } from "@/modules/auth";
import { getLink } from "@/modules/links";

export default async function LinkAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const link = await getLink(id);
  if (!link || link.organizationId !== user.profile.organizationId) notFound();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-xs text-muted-foreground uppercase">Enlace</p>
        <h1 className="mt-2 truncate font-mono text-lg font-semibold">{link.destinationUrl}</h1>
      </div>
      <EventAnalyticsPanel
        linkId={id}
        heading="Clics"
        surface="links"
        dataUrl={`/links/${id}/analytics/data`}
        csvUrl={`/links/${id}/analytics/csv`}
        emptyMessage="Aún no hay clics en este rango."
        showBreakdowns={false}
      />
    </div>
  );
}
