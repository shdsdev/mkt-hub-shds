import { getCurrentUser } from "@/modules/auth";
import { listDomains } from "@/modules/links";
import { DomainForm } from "../domain-form";

export default async function DomainsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const domains = await listDomains(user.profile.organizationId);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading font-medium">Dominios</h2>
        <p className="text-sm text-muted-foreground">
          Todo enlace corto y código QR resuelve a través de uno de estos.
        </p>
      </div>
      <DomainForm domains={domains} />
    </section>
  );
}
