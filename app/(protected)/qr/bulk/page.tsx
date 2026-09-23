import { BulkQrImport } from "./bulk-qr-import";
import { getCurrentUser } from "@/modules/auth";
import { listFolders } from "@/modules/links";
import { listCampaigns } from "@/modules/campaigns";
import { listQrDesignTemplates } from "@/modules/qr";
import { getOrganization } from "@/modules/users";

export default async function BulkQrImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const organizationId = user.profile.organizationId;
  const [folders, campaigns, templates, organization] = await Promise.all([
    listFolders(organizationId),
    listCampaigns(organizationId),
    listQrDesignTemplates(organizationId),
    getOrganization(organizationId),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-semibold">Importar códigos QR</h1>
        <p className="text-sm text-muted-foreground">
          Crea hasta 200 códigos QR dinámicos de sitio web desde un archivo CSV.
        </p>
      </div>
      <BulkQrImport
        organizationId={organizationId}
        folders={folders}
        campaigns={campaigns}
        templates={templates}
        defaultLogoUrl={organization?.defaultLogoUrl ?? undefined}
      />
    </div>
  );
}
