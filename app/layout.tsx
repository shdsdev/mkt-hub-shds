import type { Metadata } from "next";
import { Poppins, Inter, Jersey_25, JetBrains_Mono } from "next/font/google";
import { getCurrentUser } from "@/modules/auth";
import { DEFAULT_THEME_ID, getThemeColorOverrides, buildThemeOverrideStyle } from "@/modules/users";
import { AuraBackground, type AuraThemeId } from "@/components/aura-background";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Digital/LCD-style display font (source: designsurface.dev's own h1/h2 computed styles).
const jersey25 = Jersey_25({
  variable: "--font-jersey",
  subsets: ["latin"],
  weight: "400",
});

// Monospace for code-like/data values (short URLs, IDs) — same source as jersey25.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

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
      className={`dark ${poppins.variable} ${inter.variable} ${jersey25.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      {themeOverrideStyle && (
        <head>
          <style>{`html[data-app-theme="${themeId}"]{${themeOverrideStyle}}`}</style>
        </head>
      )}
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
