import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
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
      className={`dark ${poppins.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
