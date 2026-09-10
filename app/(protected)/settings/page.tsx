import { getCurrentUser } from "@/modules/auth";
import { THEMES, DEFAULT_THEME_ID } from "@/modules/users";
import { updateUserThemeAction } from "./actions";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const activeThemeId = user.profile.theme ?? DEFAULT_THEME_ID;

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
    </div>
  );
}
