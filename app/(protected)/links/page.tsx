import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { listLinks, listDomains } from "@/modules/links";
import { listUtmPresets } from "@/modules/utm";
import { LinkForm } from "./link-form";
import { DomainForm } from "./domain-form";
import { UtmPresetForm } from "./utm-preset-form";

export default async function LinksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [links, domains, presets] = await Promise.all([
    listLinks(user.profile.organizationId),
    listDomains(user.profile.organizationId),
    listUtmPresets(user.profile.organizationId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Enlaces</h1>
        <p className="text-sm text-muted-foreground">
          Todo enlace corto y código QR se resuelve a través de uno de estos — editar el destino
          acá actualiza todos a la vez.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <LinkForm presets={presets} />
        <DomainForm domains={domains} />
        <UtmPresetForm presets={presets} />
      </div>

      <div className="space-y-2">
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay enlaces.</p>
        )}
        {links.map((link) => (
          <Link
            key={link.id}
            href={`/links/${link.id}`}
            className="block rounded-md border border-border bg-card p-4 hover:border-primary"
          >
            <p className="truncate font-medium">{link.destinationUrl}</p>
            <p className="text-xs text-muted-foreground">
              {link.status === "active" ? "activo" : "archivado"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
