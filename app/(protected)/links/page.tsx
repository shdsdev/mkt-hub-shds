import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { listLinks, listDomains } from "@/modules/links";
import { LinkForm } from "./link-form";
import { DomainForm } from "./domain-form";

export default async function LinksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [links, domains] = await Promise.all([
    listLinks(user.profile.organizationId),
    listDomains(user.profile.organizationId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Links</h1>
        <p className="text-sm text-muted-foreground">
          Every short link and QR code resolves through one of these — editing the destination
          here updates all of them at once.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <LinkForm />
        <DomainForm domains={domains} />
      </div>

      <div className="space-y-2">
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        )}
        {links.map((link) => (
          <Link
            key={link.id}
            href={`/links/${link.id}`}
            className="block rounded-md border border-border bg-card p-4 hover:border-primary"
          >
            <p className="truncate font-medium">{link.destinationUrl}</p>
            <p className="text-xs text-muted-foreground">{link.status}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
