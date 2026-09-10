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
  LogOut,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "./actions";

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

function NavItem({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={active} render={<Link href={href} />}>
        <Icon size={16} />
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const qrShortLinksActive = pathname.startsWith("/links") || pathname.startsWith("/qr");
  const [qrShortLinksOpen, setQrShortLinksOpen] = useState(qrShortLinksActive);

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-4 pt-6 pb-0">
        <span className="font-heading text-lg font-semibold">Marketing Hub</span>
      </SidebarHeader>

      <SidebarContent className="mt-6 gap-6 px-4">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 h-auto px-0 py-1 text-xs text-sidebar-muted">
            General
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <NavItem href="/" icon={LayoutDashboard}>
                Resumen
              </NavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 h-auto px-0 py-1 text-xs text-sidebar-muted">
            Herramientas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={qrShortLinksActive}
                  onClick={() => setQrShortLinksOpen((open) => !open)}
                >
                  <QrCode size={16} />
                  <span className="flex-1">QR Short Links</span>
                  {qrShortLinksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {qrShortLinksOpen && (
                <div className="ml-3 space-y-1.5 border-l border-sidebar-border pl-3">
                  <NavItem href="/links" icon={Link2}>
                    Enlaces
                  </NavItem>
                  <NavItem href="/qr" icon={ScanLine}>
                    Códigos QR
                  </NavItem>
                </div>
              )}
              <NavItem href="/campaigns" icon={Megaphone}>
                Campañas
              </NavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 h-auto px-0 py-1 text-xs text-sidebar-muted">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <NavItem href="/audit" icon={ScrollText}>
                Registro de auditoría
              </NavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 pb-6">
        <SidebarMenu className="gap-1.5">
          <NavItem href="/settings" icon={SettingsIcon}>
            Configuración
          </NavItem>
          <SidebarMenuItem>
            <form action={signOutAction}>
              <SidebarMenuButton
                type="submit"
                className="w-full text-sidebar-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut size={16} />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-sm text-sidebar-foreground outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[popup-open]:bg-sidebar-accent">
                <Avatar size="sm">
                  <AvatarFallback>{initials(email)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-left text-sm font-medium">{email}</span>
                <ChevronsUpDown size={14} className="shrink-0 text-sidebar-foreground/50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium text-foreground">{email}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
