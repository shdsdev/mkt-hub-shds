import { getCurrentUser } from "@/modules/auth";
import { VISIBLE_THEMES, DEFAULT_THEME_ID, getThemeColorOverrides, isAdmin } from "@/modules/users";
import { updateUserThemeAction } from "../actions";
import { ThemeColorEditor } from "./theme-color-editor";

export default async function GeneralSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const activeThemeId = user.profile.theme ?? DEFAULT_THEME_ID;
  const canEditThemeColors = isAdmin(user.profile);
  const themeOverrides = canEditThemeColors ? await getThemeColorOverrides() : {};

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading font-medium">Temas</h2>
        <p className="text-sm text-muted-foreground">Elegí la paleta de colores de la interfaz.</p>
      </div>
       {canEditThemeColors ? <>
       <p className="pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Temas principales</p>
       <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
         {VISIBLE_THEMES.slice(0, 2).map((theme) => {
          const isActive = theme.id === activeThemeId;
          return (
            // Not a <button> itself — the theme-select submit button below is one child, and the
            // ADMIN-only "Editar colores" trigger (also a <button>, via ThemeColorEditor) is a
            // sibling, since a <button> can't nest inside another <button>.
            <div key={theme.id} className="relative">
              <form action={updateUserThemeAction}>
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
                        key={`${theme.id}-${color}-${theme.swatch.indexOf(color)}`}
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
              {canEditThemeColors && (
                <div className="mt-1.5 text-right">
                  <ThemeColorEditor theme={theme} overrides={themeOverrides[theme.id]} />
                </div>
              )}
            </div>
          );
         })}
       </div>
       <p className="pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Temas secundarios</p>
       <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
         {VISIBLE_THEMES.slice(2).map((theme) => {
           const isActive = theme.id === activeThemeId;
           return <div key={theme.id} className="relative"><form action={updateUserThemeAction}><input type="hidden" name="themeId" value={theme.id} /><button type="submit" disabled={isActive} className={`w-full space-y-3 rounded-lg border bg-card p-4 text-left ${isActive ? "border-primary" : "border-border hover:border-primary/50"}`}><div className="flex gap-1.5">{theme.swatch.map((color, index) => <span key={`${theme.id}-${color}-${index}`} className="h-8 w-8 rounded-full border border-border" style={{ backgroundColor: color }} />)}</div><p className="text-sm font-medium">{theme.label}{isActive && <span className="ml-2 text-xs text-primary">Activo</span>}</p></button></form><div className="mt-1.5 text-right"><ThemeColorEditor theme={theme} overrides={themeOverrides[theme.id]} /></div></div>;
         })}
       </div>
       </> : <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Tu tema es administrado por un administrador de la organización.</div>}
    </section>
  );
}
