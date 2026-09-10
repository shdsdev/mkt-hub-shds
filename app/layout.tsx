import type { Metadata } from "next";
import { Poppins, Inter, Jersey_25, JetBrains_Mono } from "next/font/google";
import { getCurrentUser } from "@/modules/auth";
import { DEFAULT_THEME_ID } from "@/modules/users";
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

  return (
    <html
      lang="es"
      data-app-theme={themeId}
      className={`dark ${poppins.variable} ${inter.variable} ${jersey25.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
