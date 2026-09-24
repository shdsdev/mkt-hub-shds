import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { listQrCodes, listQrDesignTemplates, listQrGroupAvailability } from "@/modules/qr";
import { listLinks, listShortLinksForOrganization, listDomains, listFolders } from "@/modules/links";
import { listCampaigns } from "@/modules/campaigns";
import { listUtmPresets } from "@/modules/utm";
import { countEventsForQrCodes } from "@/modules/analytics";
import { getOrganization } from "@/modules/users";
import { QrList, type QrListRow } from "./qr-list";

const PAGE_SIZE = 20;

const qrListSearchParamsSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  status: z.enum(["active", "archived", "disabled"]).optional().catch(undefined),
  mode: z.enum(["dynamic", "static"]).optional().catch(undefined),
  folder: z.string().min(1).optional().catch(undefined),
  campaign: z.string().min(1).optional().catch(undefined),
  q: z.string().trim().min(1).optional().catch(undefined),
});

export default async function QrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgId = user.profile.organizationId;
  const rawSearchParams = await searchParams;
  const parsedSearchParams = qrListSearchParamsSchema.parse(
    Object.fromEntries(Object.entries(rawSearchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])),
  );
  const filter = {
    page: parsedSearchParams.page,
    pageSize: PAGE_SIZE,
    status: parsedSearchParams.status,
    mode: parsedSearchParams.mode,
    folderId: parsedSearchParams.folder,
    campaignId: parsedSearchParams.campaign,
    search: parsedSearchParams.q,
  };
  const [qrResult, groupAvailability, links, shortLinks, domains, folders, campaigns, utmPresets, templates, organization] = await Promise.all([
    listQrCodes(orgId, filter),
    listQrGroupAvailability(orgId),
    listLinks(orgId),
    listShortLinksForOrganization(orgId),
    listDomains(orgId),
    listFolders(orgId),
    listCampaigns(orgId),
    listUtmPresets(orgId),
    listQrDesignTemplates(orgId),
    getOrganization(orgId),
  ]);
  const { rows: qrCodes, total, page } = qrResult;
  const scanCounts = await countEventsForQrCodes(qrCodes);
  const filterFolders = folders.filter((folder) => groupAvailability.folderIds.includes(folder.id));
  const filterCampaigns = campaigns.filter(
    (campaign) => campaign.status === "active" && groupAvailability.campaignIds.includes(campaign.id),
  );

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

  const rows: QrListRow[] = qrCodes.map((qr) => {
      const scanCount = scanCounts.get(qr.id) ?? 0;

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
           folderId: qr.folderId,
           campaignId: qr.campaignId,
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
         folderId: qr.folderId,
         campaignId: qr.campaignId,
       };
    });

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
      </div>

      <QrList
        rows={rows}
        organizationId={orgId}
        folders={folders}
        campaigns={campaigns}
        filterFolders={filterFolders}
        filterCampaigns={filterCampaigns}
        utmPresets={utmPresets}
         templates={templates}
         defaultLogoUrl={organization?.defaultLogoUrl ?? undefined}
         total={total}
         page={page}
         pageSize={PAGE_SIZE}
         filter={filter}
       />
    </div>
  );
}
