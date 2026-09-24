import { getCurrentUser } from "@/modules/auth";
import {
  listUtmPresets,
  getActiveTaxonomyOptions,
  SOURCE_OPTIONS,
  MEDIUM_OPTIONS,
} from "@/modules/utm";
import { listCampaigns } from "@/modules/campaigns";
import { UtmPresetsForm } from "./utm-presets-form";

export default async function UtmSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [presets, campaigns] = await Promise.all([
    listUtmPresets(user.profile.organizationId),
    listCampaigns(user.profile.organizationId),
  ]);

  const sourceOptions = getActiveTaxonomyOptions(SOURCE_OPTIONS);
  const mediumOptions = getActiveTaxonomyOptions(MEDIUM_OPTIONS);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading font-medium">Plantillas UTM</h2>
        <p className="text-sm text-muted-foreground">
          Gestioná plantillas de UTM reutilizables para aplicar después en enlaces — acá no se
          generan enlaces ni códigos QR.
        </p>
      </div>
      <UtmPresetsForm
        presets={presets}
        campaigns={campaigns}
        sourceOptions={sourceOptions}
        mediumOptions={mediumOptions}
      />
    </section>
  );
}
