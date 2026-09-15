import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { getLink, getShortLink, getDomain } from "@/modules/links";
import { getQrCodeByLinkId } from "@/modules/qr";
import { getAnalyticsForLinkGrouped } from "@/modules/analytics";
import { CopyButton } from "@/components/copy-button";
import { ScansPanel } from "./scans-panel";
import { ActivityHeatmap } from "./activity-heatmap";
import { buildHeatmapWeeks } from "./heatmap";
import { EditDestinationButton } from "./edit-destination-button";

const HEATMAP_WEEKS = 20;

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

  // A link reached here may or may not have a QR (this page is also linked from the Links page's
  // "View analytics", which works for a plain short link with no QR ever made) — the header shows
  // QR-specific chrome only when one exists.
  const qr = await getQrCodeByLinkId(linkId);
  const shortLink = qr?.shortLinkId ? await getShortLink(qr.shortLinkId) : undefined;
  const domain = shortLink ? await getDomain(shortLink.domainId) : undefined;
  const shortUrl = shortLink && domain ? `https://${domain.hostname}/q/${shortLink.slug}` : undefined;

  const today = new Date();
  const heatmapFrom = new Date(today);
  heatmapFrom.setUTCDate(heatmapFrom.getUTCDate() - (HEATMAP_WEEKS * 7 - 1));

  const heatmapRows = await getAnalyticsForLinkGrouped(
    linkId,
    "qr_scan",
    "day",
    heatmapFrom,
    today,
  );

  const heatmapCounts = new Map(heatmapRows.map((row) => [row.bucket, row.count]));
  const heatmapWeeks = buildHeatmapWeeks(heatmapCounts, HEATMAP_WEEKS, today);
  const heatmapTotal = heatmapRows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
            Sitio web
            {qr && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs normal-case ${
                  qr.status === "active" ? "bg-accent/20 text-accent" : "bg-muted"
                }`}
              >
                {qr.status === "active" ? "Activo" : "Archivado"}
              </span>
            )}
          </p>
          <h1 className="truncate text-lg font-semibold">{qr?.name || link.destinationUrl}</h1>
          {qr?.name && (
            <p className="truncate font-mono text-sm text-muted-foreground">{link.destinationUrl}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Creado el {link.createdAt.toLocaleDateString()}
          </p>
          {qr && (
            <div className="flex items-center gap-2">
              <a
                href={`/qr/${qr.id}/download?format=png`}
                className="inline-block rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
              >
                Descargar
              </a>
              <EditDestinationButton
                qrId={qr.id}
                linkId={linkId}
                name={qr.name}
                destinationUrl={link.destinationUrl}
              />
            </div>
          )}
        </div>

        {qr && (
          <div className="flex shrink-0 flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/qr/${qr.id}/download?format=png`}
              alt="Código QR"
              className="h-32 w-32 rounded-md border border-border"
            />
            {shortUrl && (
              <p className="flex items-center gap-1.5 font-mono text-sm text-accent">
                {shortUrl}
                <CopyButton value={shortUrl} />
              </p>
            )}
          </div>
        )}
      </div>

      <ScansPanel linkId={linkId} />

      <ActivityHeatmap weeks={heatmapWeeks} total={heatmapTotal} />
    </div>
  );
}
