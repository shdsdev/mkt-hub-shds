import { getCurrentUser } from "@/modules/auth";
import { listQrCodes } from "@/modules/qr";
import { listLinks, listShortLinksForOrganization, listDomains } from "@/modules/links";
import { countEventsForQrCode } from "@/modules/analytics";
import { QrList, type QrListRow } from "./qr-list";

export default async function QrPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgId = user.profile.organizationId;
  const [qrCodes, links, shortLinks, domains] = await Promise.all([
    listQrCodes(orgId),
    listLinks(orgId),
    listShortLinksForOrganization(orgId),
    listDomains(orgId),
  ]);

  const linksById = new Map(links.map((link) => [link.id, link]));
  const shortLinksById = new Map(shortLinks.map((shortLink) => [shortLink.id, shortLink]));
  const domainsById = new Map(domains.map((domain) => [domain.id, domain]));

  const rows: QrListRow[] = await Promise.all(
    qrCodes.map(async (qr) => {
      const scanCount = await countEventsForQrCode(qr.id);

      if (qr.mode === "dynamic" && qr.shortLinkId && qr.linkId) {
        const shortLink = shortLinksById.get(qr.shortLinkId);
        const domain = shortLink ? domainsById.get(shortLink.domainId) : undefined;
        const link = linksById.get(qr.linkId);
        return {
          id: qr.id,
          mode: "dynamic" as const,
          status: qr.status,
          createdAt: qr.createdAt,
          logoUrl: qr.logoUrl,
          destinationUrl: link?.destinationUrl,
          shortUrl: shortLink && domain ? `https://${domain.hostname}/q/${shortLink.slug}` : undefined,
          linkId: qr.linkId,
          scanCount,
        };
      }

      return {
        id: qr.id,
        mode: "static" as const,
        status: qr.status,
        createdAt: qr.createdAt,
        logoUrl: qr.logoUrl,
        payload: qr.staticPayload ?? undefined,
        scanCount,
      };
    }),
  );

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">QR Codes</h1>
          <p className="text-sm text-muted-foreground">
            Website QR codes are trackable and stay editable after printing. Fixed text QR codes
            encode a permanent payload and can never be changed.
          </p>
        </div>
      </div>

      <QrList rows={rows} organizationId={orgId} />
    </div>
  );
}
