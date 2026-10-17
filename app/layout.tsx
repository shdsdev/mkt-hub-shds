/* eslint-disable @next/next/no-page-custom-font -- Google Fonts are intentionally loaded in the root App Router layout. */
import type { Metadata } from "next";
import { getCurrentUser } from "@/modules/auth";
import { DEFAULT_THEME_ID, getThemeColorOverrides, buildThemeOverrideStyle } from "@/modules/users";
import { AuraBackground, type AuraThemeId } from "@/components/aura-background";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketing Hub",
  description: "Hub interno de acortador de enlaces, códigos QR, campañas y analíticas.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const themeId = user?.profile.theme ?? DEFAULT_THEME_ID;
  const auraThemeIds: AuraThemeId[] = ["nightfall", "greydlu", "aston", "signature", "midnight", "arctic-frost"];
  const auraTheme = auraThemeIds.find((id) => id === themeId);
  // ADMIN color overrides (2026-10-15 design) — a per-token delta on top of the fixed
  // [data-app-theme="..."] CSS block. Rendered as its own <style> tag with an `html[data-app-theme=
  // "..."]` selector (element + attribute = higher specificity than the plain attribute selector
  // in globals.css), so it always wins regardless of bundler/stylesheet source order — no
  // `!important` needed.
  const themeOverrides = await getThemeColorOverrides();
  const themeOverrideStyle = buildThemeOverrideStyle(themeOverrides[themeId]);

  return (
    <html
      lang="es"
      data-app-theme={themeId}
      className="dark h-full"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cutive+Mono&family=Inter:wght@500;600;700&family=Quicksand:wght@300..700&display=swap"
          rel="stylesheet"
        />
        {themeOverrideStyle && (
          <style>{`html[data-app-theme="${themeId}"]{${themeOverrideStyle}}`}</style>
        )}
      </head>
      {/* Browser extensions (ClickUp, LanguageTool, Grammarly...) inject classes/attributes into
          html/body before React hydrates — a benign mismatch, but without this Next.js's dev
          overlay covers the whole page with a false-alarm error on every load. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {auraTheme && <AuraBackground theme={auraTheme} />}
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
