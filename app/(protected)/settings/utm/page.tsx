import { getCurrentUser } from "@/modules/auth";
import { listUtmPresets } from "@/modules/utm";
import { UtmPresetsForm } from "./utm-presets-form";

export default async function UtmSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const presets = await listUtmPresets(user.profile.organizationId);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading font-medium">Plantillas UTM</h2>
        <p className="text-sm text-muted-foreground">
          Guardá combinaciones de UTM para reutilizar en códigos QR y enlaces.
        </p>
      </div>
      <UtmPresetsForm presets={presets} />
    </section>
  );
}
