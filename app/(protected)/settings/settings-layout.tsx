"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const activeItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const activeItem = activeItemRef.current;
    const list = activeItem?.parentElement;
    if (!activeItem || !list || list.scrollWidth <= list.clientWidth) return;

    const targetLeft = activeItem.offsetLeft - (list.clientWidth - activeItem.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-8">
      <nav className="settings-nav-scroll max-w-full overflow-x-auto overscroll-x-contain" aria-label="Secciones de configuración">
        <div className="flex w-full min-w-max gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                ref={active ? activeItemRef : undefined}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={active
                  ? "flex min-h-10 min-w-max flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm ring-1 ring-accent/60 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
                  : "flex min-h-10 min-w-max flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
