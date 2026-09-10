"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  QrCode,
  Link2,
  ScanLine,
  Megaphone,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";

function NavLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon?: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
        active
          ? "bg-sidebar-active text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">{children}</p>;
}

export function Sidebar() {
  const pathname = usePathname();
  const qrShortLinksActive = pathname.startsWith("/links") || pathname.startsWith("/qr");
  const [qrShortLinksOpen, setQrShortLinksOpen] = useState(qrShortLinksActive);

  return (
    <nav className="w-[276px] shrink-0 space-y-1 border-r border-border p-4">
      <SectionLabel>General</SectionLabel>
      <NavLink href="/" icon={LayoutDashboard}>
        Resumen
      </NavLink>

      <SectionLabel>Herramientas</SectionLabel>
      <div>
        <button
          type="button"
          onClick={() => setQrShortLinksOpen((open) => !open)}
          className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
            qrShortLinksActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <QrCode size={16} />
            QR Short Links
          </span>
          <span>{qrShortLinksOpen ? "▾" : "▸"}</span>
        </button>
        {qrShortLinksOpen && (
          <div className="ml-3 space-y-1 border-l border-border pl-3">
            <NavLink href="/links" icon={Link2}>
              Enlaces
            </NavLink>
            <NavLink href="/qr" icon={ScanLine}>
              Códigos QR
            </NavLink>
          </div>
        )}
      </div>
      <NavLink href="/campaigns" icon={Megaphone}>
        Campañas
      </NavLink>

      <SectionLabel>Sistema</SectionLabel>
      <NavLink href="/audit" icon={ScrollText}>
        Registro de auditoría
      </NavLink>
      <NavLink href="/settings" icon={SettingsIcon}>
        Configuración
      </NavLink>
    </nav>
  );
}
