import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { getLink, listShortLinksForLink, listDomains } from "@/modules/links";
import { getScanRateForShortLink } from "@/modules/campaigns";
import { DestinationForm } from "./destination-form";
import { ShortLinkForm } from "./short-link-form";
import { ArchiveLinkButton, ArchiveShortLinkButton } from "./archive-button";
import { PrintRunForm } from "./print-run-form";

export default async function LinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const link = await getLink(id);
  if (!link || link.organizationId !== user.profile.organizationId) {
    notFound();
  }

  const [shortLinks, domains] = await Promise.all([
    listShortLinksForLink(id),
    listDomains(user.profile.organizationId),
  ]);
  const domainById = new Map(domains.map((domain) => [domain.id, domain.hostname]));
  const scanRates = await Promise.all(
    shortLinks.map((shortLink) => getScanRateForShortLink(shortLink.id)),
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Link</h1>
          <p className="text-sm text-muted-foreground">
            Editing the destination here updates every short link and QR code below immediately —
            none of them store a destination of their own (ARCHITECTURE.md I-1).
          </p>
        </div>
        {link.status === "active" && <ArchiveLinkButton linkId={link.id} />}
        {link.status !== "active" && (
          <span className="text-xs text-muted-foreground">{link.status}</span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Destination</p>
        <DestinationForm linkId={link.id} destinationUrl={link.destinationUrl} />
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Short links</p>
        <ul className="space-y-3">
          {shortLinks.length === 0 && (
            <li className="text-sm text-muted-foreground">None yet.</li>
          )}
          {shortLinks.map((shortLink, index) => {
            const scanRate = scanRates[index];
            return (
              <li key={shortLink.id} className="space-y-2 rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    {domainById.get(shortLink.domainId)}/{shortLink.slug}
                    {shortLink.status !== "active" && (
                      <span className="ml-2 text-xs text-muted-foreground">{shortLink.status}</span>
                    )}
                  </span>
                  {shortLink.status === "active" && (
                    <ArchiveShortLinkButton shortLinkId={shortLink.id} linkId={link.id} />
                  )}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <PrintRunForm shortLinkId={shortLink.id} linkId={link.id} />
                  <span className="text-xs text-muted-foreground">
                    {scanRate === null
                      ? "no print run recorded"
                      : `${(scanRate * 100).toFixed(1)}% scan rate`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <ShortLinkForm linkId={link.id} domains={domains} />
      </div>
    </div>
  );
}
