import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { getLink, listShortLinksForLink, listDomains } from "@/modules/links";
import { DestinationForm } from "./destination-form";
import { ShortLinkForm } from "./short-link-form";

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

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Link</h1>
        <p className="text-sm text-muted-foreground">
          Editing the destination here updates every short link and QR code below immediately —
          none of them store a destination of their own (ARCHITECTURE.md I-1).
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Destination</p>
        <DestinationForm linkId={link.id} destinationUrl={link.destinationUrl} />
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Short links</p>
        <ul className="space-y-1">
          {shortLinks.length === 0 && (
            <li className="text-sm text-muted-foreground">None yet.</li>
          )}
          {shortLinks.map((shortLink) => (
            <li key={shortLink.id} className="rounded-md border border-border bg-card p-3 text-sm">
              {domainById.get(shortLink.domainId)}/{shortLink.slug}
            </li>
          ))}
        </ul>
        <ShortLinkForm linkId={link.id} domains={domains} />
      </div>
    </div>
  );
}
