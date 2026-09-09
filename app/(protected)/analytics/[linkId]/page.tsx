import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { getLink, getShortLink, getDomain } from "@/modules/links";
import { getQrCodeByLinkId } from "@/modules/qr";
import { countQrScansForLink, countUniqueQrScansForLink } from "@/modules/analytics";
import { CopyButton } from "@/components/copy-button";
import { ScansPanel } from "./scans-panel";

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

  const [totalScans, uniqueScans] = await Promise.all([
    countQrScansForLink(linkId),
    countUniqueQrScansForLink(linkId),
  ]);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
            Website
            {qr && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs normal-case ${
                  qr.status === "active" ? "bg-accent/20 text-accent" : "bg-muted"
                }`}
              >
                {qr.status === "active" ? "Active" : "Archived"}
              </span>
            )}
          </p>
          <h1 className="truncate font-heading text-xl font-semibold">{link.destinationUrl}</h1>
          <p className="text-xs text-muted-foreground">
            Created {link.createdAt.toLocaleDateString()}
          </p>
          {qr && (
            <a
              href={`/qr/${qr.id}/download?format=png`}
              className="inline-block rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
            >
              Download
            </a>
          )}
        </div>

        {qr && (
          <div className="flex shrink-0 flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/qr/${qr.id}/download?format=png`}
              alt="QR code"
              className="h-32 w-32 rounded-md border border-border"
            />
            {shortUrl && (
              <p className="flex items-center gap-1.5 text-sm text-accent">
                {shortUrl}
                <CopyButton value={shortUrl} />
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:w-fit sm:grid-cols-2">
        <Stat label="Total scans" value={totalScans} />
        <Stat label="Unique scans" value={uniqueScans} />
      </div>

      <ScansPanel linkId={linkId} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-40 rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className="font-heading text-2xl font-semibold">{value}</p>
    </div>
  );
}
