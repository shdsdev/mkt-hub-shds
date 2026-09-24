"use client";

import { HookSidebar } from "@/components/ui/hook-sidebar";

const settingsNav = [
  { label: "General", href: "/settings/general" },
  { label: "Logotipo", href: "/settings/logo" },
  { label: "Dominios", href: "/settings/domains" },
  { label: "Plantillas UTM", href: "/settings/utm" },
  { label: "Usuarios", href: "/settings/users" },
];

export function SettingsLayout({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
}) {
  const visibleNav = isAdmin
    ? settingsNav
    : settingsNav.filter((item) => item.href !== "/settings/users");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start">
      <aside className="lg:w-56 lg:shrink-0">
        <HookSidebar
          aria-label="Secciones de configuración"
          items={visibleNav}
          color="var(--accent)"
          dashed={false}
        />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
