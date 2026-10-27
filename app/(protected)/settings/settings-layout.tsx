"use client";

import { HookSidebar } from "@/components/ui/hook-sidebar";

const settingsNav = [
  { label: "General", href: "/settings/general" },
  { label: "Logotipo", href: "/settings/logo" },
  { label: "Dominios", href: "/settings/domains" },
  { label: "Plantillas UTM", href: "/settings/utm" },
  { label: "Usuarios", href: "/settings/users", adminOnly: true },
  { label: "Integraciones", href: "/settings/integrations", adminOnly: true },
  { label: "Monitoreo", href: "/settings/monitoring", adminOnly: true },
];

export function SettingsLayout({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
}) {
  const visibleNav = settingsNav.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-8 xl:flex-row xl:items-start">
      <aside className="xl:w-56 xl:shrink-0">
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
