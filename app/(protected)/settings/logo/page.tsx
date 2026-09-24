import { getCurrentUser } from "@/modules/auth";
import { getOrganization } from "@/modules/users";
import { DefaultLogoUpload } from "../default-logo-upload";

export default async function LogoSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const organization = await getOrganization(user.profile.organizationId);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading font-medium">Logotipo</h2>
        <p className="text-sm text-muted-foreground">
          Logotipo por defecto — se pre-carga en cada código QR nuevo.
        </p>
      </div>
      <DefaultLogoUpload
        organizationId={user.profile.organizationId}
        currentLogoUrl={organization?.defaultLogoUrl ?? undefined}
      />
    </section>
  );
}
