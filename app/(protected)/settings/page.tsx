import Link from "next/link";
import { getCurrentUser } from "@/modules/auth";
import { THEMES, DEFAULT_THEME_ID, getOrganization, isActive, isAdmin } from "@/modules/users";
import { listDomains } from "@/modules/links";
import { updateUserThemeAction } from "./actions";
import { DefaultLogoUpload } from "./default-logo-upload";
import { DomainForm } from "./domain-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const activeThemeId = user.profile.theme ?? DEFAULT_THEME_ID;
  const [organization, domains] = await Promise.all([
    getOrganization(user.profile.organizationId),
    listDomains(user.profile.organizationId),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Preferencias personales de tu cuenta.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading font-medium">Temas</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {THEMES.map((theme) => {
            const isActive = theme.id === activeThemeId;
            return (
              <form key={theme.id} action={updateUserThemeAction}>
                <input type="hidden" name="themeId" value={theme.id} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`w-full space-y-3 rounded-lg border bg-card p-4 text-left ${
                    isActive ? "border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex gap-1.5">
                    {theme.swatch.map((color) => (
                      <span
                        key={color}
                        className="h-8 w-8 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-medium">
                    {theme.label}
                    {isActive && (
                      <span className="ml-2 text-xs text-primary">Activo</span>
                    )}
                  </p>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-medium">Logotipo</h2>
        <DefaultLogoUpload
          organizationId={user.profile.organizationId}
          currentLogoUrl={organization?.defaultLogoUrl ?? undefined}
        />
      </section>

      {isActive(user.profile) && isAdmin(user.profile) && (
        <section className="space-y-3">
          <h2 className="font-heading font-medium">Usuarios</h2>
          <p className="text-sm text-muted-foreground">
            Administra las invitaciones, roles y el acceso de tu organización.
          </p>
          <Link href="/settings/users" className="text-sm font-medium text-primary hover:underline">
            Administrar usuarios
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <DomainForm domains={domains} />
      </section>
    </div>
  );
}
