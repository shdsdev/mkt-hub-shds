import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { getLink, listShortLinksForLink, listDomains } from "@/modules/links";
import { getScanRateForShortLink } from "@/modules/campaigns";
import { DestinationForm } from "./destination-form";
import { ShortLinkForm } from "./short-link-form";
import { ArchiveLinkButton, ArchiveShortLinkButton } from "./archive-button";
import { PrintRunForm } from "./print-run-form";

const RESOURCE_STATUS_LABEL: Record<string, string> = {
  active: "activo",
  archived: "archivado",
  disabled: "deshabilitado",
};

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
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Enlace</h1>
          <p className="text-sm text-muted-foreground">
            Editar el destino acá actualiza todos los enlaces cortos y códigos QR de abajo al
            instante — ninguno guarda un destino propio (ARCHITECTURE.md I-1).
          </p>
          <Link href={`/analytics/${link.id}`} className="text-sm text-accent hover:underline">
            Ver analíticas
          </Link>
        </div>
        {link.status === "active" && <ArchiveLinkButton linkId={link.id} />}
        {link.status !== "active" && (
          <span className="text-xs text-muted-foreground">
            {RESOURCE_STATUS_LABEL[link.status]}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Destino</p>
        <DestinationForm linkId={link.id} destinationUrl={link.destinationUrl} />
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Enlaces cortos</p>
        <ul className="space-y-3">
          {shortLinks.length === 0 && (
            <li className="text-sm text-muted-foreground">Aún no hay ninguno.</li>
          )}
          {shortLinks.map((shortLink, index) => {
            const scanRate = scanRates[index];
            return (
              <li key={shortLink.id} className="space-y-2 rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    {domainById.get(shortLink.domainId)}/{shortLink.slug}
                    {shortLink.status !== "active" && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {RESOURCE_STATUS_LABEL[shortLink.status]}
                      </span>
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
                      ? "sin tirada registrada"
                      : `${(scanRate * 100).toFixed(1)}% de escaneo`}
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
