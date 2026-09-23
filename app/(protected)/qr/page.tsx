import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { listQrCodes, listQrDesignTemplates } from "@/modules/qr";
import { listLinks, listShortLinksForOrganization, listDomains, listFolders } from "@/modules/links";
import { listCampaigns } from "@/modules/campaigns";
import { listUtmPresets } from "@/modules/utm";
import { countEventsForQrCode } from "@/modules/analytics";
import { getOrganization } from "@/modules/users";
import { buttonVariants } from "@/components/ui/button";
import { QrList, type QrListRow } from "./qr-list";

export default async function QrPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgId = user.profile.organizationId;
  const [qrCodes, links, shortLinks, domains, folders, campaigns, utmPresets, templates, organization] = await Promise.all([
    listQrCodes(orgId),
    listLinks(orgId),
    listShortLinksForOrganization(orgId),
    listDomains(orgId),
    listFolders(orgId),
    listCampaigns(orgId),
    listUtmPresets(orgId),
    listQrDesignTemplates(orgId),
    getOrganization(orgId),
  ]);

  const linksById = new Map(links.map((link) => [link.id, link]));
  const shortLinksById = new Map(shortLinks.map((shortLink) => [shortLink.id, shortLink]));
  const domainsById = new Map(domains.map((domain) => [domain.id, domain]));
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const campaignsById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  function groupName(qr: { folderId: string | null; campaignId: string | null }): string | undefined {
    if (qr.folderId) return foldersById.get(qr.folderId)?.name;
    if (qr.campaignId) return campaignsById.get(qr.campaignId)?.name;
    return undefined;
  }

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
          utmSource: link?.utmSource,
          utmMedium: link?.utmMedium,
          utmCampaign: link?.utmCampaign,
          utmTerm: link?.utmTerm,
          utmContent: link?.utmContent,
          scanCount,
          name: qr.name,
          groupName: groupName(qr),
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
        name: qr.name,
        staticKind: qr.staticKind ?? undefined,
        groupName: groupName(qr),
      };
    }),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">Códigos QR</h1>
          <p className="text-sm text-muted-foreground">
            Los códigos QR de sitio web son rastreables y siguen siendo editables después de
            imprimirlos. Los de texto fijo codifican un contenido permanente que nunca se puede
            cambiar.
          </p>
        </div>
        <Link href="/qr/bulk" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Importar por lote
        </Link>
      </div>

      <QrList
        rows={rows}
        organizationId={orgId}
        folders={folders}
        campaigns={campaigns}
        utmPresets={utmPresets}
        templates={templates}
        defaultLogoUrl={organization?.defaultLogoUrl ?? undefined}
      />
    </div>
  );
}
