"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

const PAGE_LABELS: [prefix: string, label: string][] = [
  ["/links", "Enlaces"],
  ["/qr", "Códigos QR"],
  ["/campaigns", "Campañas"],
  ["/audit", "Registro de auditoría"],
  ["/settings", "Configuración"],
  ["/analytics", "Analíticas"],
];

function currentPageLabel(pathname: string): string {
  if (pathname === "/") return "Resumen";
  const match = PAGE_LABELS.find(([prefix]) => pathname.startsWith(prefix));
  return match?.[1] ?? "Resumen";
}

export function Breadcrumb({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      <SidebarTrigger className="md:hidden" />
      <nav className="hidden items-center gap-1 text-base text-muted-foreground md:flex">
        <span>Marketing Hub</span>
        <span className="text-border">|</span>
        <span>{orgName}</span>
        <span className="text-border">|</span>
        <span className="font-medium text-foreground/80">{currentPageLabel(pathname)}</span>
      </nav>
    </div>
  );
}
