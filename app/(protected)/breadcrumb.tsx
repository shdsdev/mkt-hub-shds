"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

type Crumb = { label: string; href?: string };

function crumbsFor(pathname: string): Crumb[] {
  if (pathname === "/") return [{ label: "Resumen" }];
  if (pathname.startsWith("/links/") && pathname.endsWith("/analytics")) {
    return [{ label: "Enlaces", href: "/links" }, { label: "Analíticas" }];
  }
  if (pathname.startsWith("/links/")) {
    return [{ label: "Enlaces", href: "/links" }, { label: "Enlace" }];
  }
  if (pathname.startsWith("/links")) return [{ label: "Enlaces" }];
  // Reached only from the QR list ("Ver analíticas" navigates here).
  if (pathname.startsWith("/analytics/")) {
    return [{ label: "Códigos QR", href: "/qr" }, { label: "Analíticas" }];
  }
  if (pathname.startsWith("/qr")) return [{ label: "Códigos QR" }];
  if (pathname.startsWith("/campaigns")) return [{ label: "Campañas" }];
  if (pathname.startsWith("/audit")) return [{ label: "Registro de auditoría" }];
  if (pathname.startsWith("/settings/users")) {
    return [{ label: "Configuración", href: "/settings" }, { label: "Usuarios" }];
  }
  if (pathname.startsWith("/settings")) return [{ label: "Configuración" }];
  return [{ label: "Resumen" }];
}

export function Breadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = crumbsFor(pathname);
  const showBack = pathname !== "/";

  return (
    <div className="flex items-center gap-2">
      <SidebarTrigger className="md:hidden" />
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Volver"
          className="hidden rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <nav className="hidden items-center gap-1 text-base text-muted-foreground md:flex">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={crumb.label} className="flex items-center gap-1">
              {i > 0 && <span className="text-border">|</span>}
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-foreground/80" : undefined}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
