"use client";

import { usePathname } from "next/navigation";

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

export function Breadcrumb() {
  const pathname = usePathname();
  return (
    <p className="text-base text-muted-foreground">
      <span className="font-heading font-semibold text-foreground">Marketing Hub</span>
      {" / "}
      {currentPageLabel(pathname)}
    </p>
  );
}
