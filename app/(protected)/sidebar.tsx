"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  LayoutDashboard,
  Gauge,
  QrCode,
  ScanLine,
  Link2,
  ExternalLink,
  Megaphone,
  Volume2,
  ScrollText,
  History,
  Settings,
  Settings2,
  LogOut,
  DoorOpen,
  ChartColumn,
  ChartColumnIncreasing,
  Users,
  UserRoundCheck,
} from "lucide";
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverMorphIcon } from "@/components/hover-morph-icon";
import { signOutAction } from "./actions";

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

function NavItem({
  href,
  idle,
  active: activeIcon,
  children,
}: {
  href: string;
  idle: typeof LayoutDashboard;
  active: typeof LayoutDashboard;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  const [hovered, setHovered] = useState(false);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        render={<Link href={href} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />}
      >
        <HoverMorphIcon idle={idle} active={activeIcon} size={16} hovered={hovered} />
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const qrShortLinksActive =
    pathname.startsWith("/links") || pathname.startsWith("/qr") || pathname.startsWith("/analytics");
  const [qrShortLinksOpen, setQrShortLinksOpen] = useState(qrShortLinksActive);
  const [qrGroupHovered, setQrGroupHovered] = useState(false);
  const [signOutHovered, setSignOutHovered] = useState(false);

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
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
              <NavItem href="/" idle={LayoutDashboard} active={Gauge}>
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
                  onMouseEnter={() => setQrGroupHovered(true)}
                  onMouseLeave={() => setQrGroupHovered(false)}
                >
                  <HoverMorphIcon idle={QrCode} active={ScanLine} size={16} hovered={qrGroupHovered} />
                  <span className="flex-1">QR Short Links</span>
                  {qrShortLinksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {qrShortLinksOpen && (
                <div className="ml-3 space-y-1.5 border-l border-sidebar-border pl-3">
                  <NavItem href="/links" idle={Link2} active={ExternalLink}>
                    Enlaces
                  </NavItem>
                  <NavItem href="/qr" idle={ScanLine} active={QrCode}>
                    Códigos QR
                  </NavItem>
                  <NavItem href="/analytics" idle={ChartColumn} active={ChartColumnIncreasing}>
                    Analytics
                  </NavItem>
                </div>
              )}
              <NavItem href="/campaigns" idle={Megaphone} active={Volume2}>
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
              <NavItem href="/audit" idle={ScrollText} active={History}>
                Registro de auditoría
              </NavItem>
              {role === "ADMIN" && (
                <NavItem href="/settings/users" idle={Users} active={UserRoundCheck}>
                  Usuarios
                </NavItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 pb-6">
        <SidebarMenu className="gap-1.5">
          <NavItem href="/settings" idle={Settings} active={Settings2}>
            Configuración
          </NavItem>
          {/* Unified profile card — avatar + email/role trigger a menu with just sign-out inside,
              replacing the previously-separate standalone sign-out button and dropdown. */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-sm text-sidebar-foreground outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[popup-open]:bg-sidebar-accent">
                <Avatar size="sm">
                  <AvatarFallback>{initials(email)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{email}</span>
                  <span className="block truncate text-xs text-sidebar-muted-foreground">{role}</span>
                </span>
                <ChevronsUpDown size={14} className="shrink-0 text-sidebar-foreground/50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-64">
                <form action={signOutAction}>
                  <DropdownMenuItem
                    variant="destructive"
                    nativeButton
                    render={<button type="submit" className="w-full" />}
                    onMouseEnter={() => setSignOutHovered(true)}
                    onMouseLeave={() => setSignOutHovered(false)}
                  >
                    <HoverMorphIcon idle={LogOut} active={DoorOpen} size={16} hovered={signOutHovered} />
                    Cerrar sesión
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
