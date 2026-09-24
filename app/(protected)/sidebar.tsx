"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  LayoutDashboard,
  Gauge,
  QrCode,
  ScanLine,
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
      {/* Hover no longer paints the shared button's own bg/text pill (canceled below) — only the
          icon picks up the theme accent on hover, via the same `hovered` state that already
          drives HoverMorphIcon's shape morph. The active route keeps its normal pill unchanged. */}
      <SidebarMenuButton
        isActive={active}
        className="hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground"
        render={<Link href={href} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />}
      >
        <span className={hovered ? "text-accent" : undefined}>
          <HoverMorphIcon idle={idle} active={activeIcon} size={16} hovered={hovered} />
        </span>
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
  const [settingsHovered, setSettingsHovered] = useState(false);

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
                  className="hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground"
                  onClick={() => setQrShortLinksOpen((open) => !open)}
                  onMouseEnter={() => setQrGroupHovered(true)}
                  onMouseLeave={() => setQrGroupHovered(false)}
                >
                  <span className={qrGroupHovered ? "text-accent" : undefined}>
                    <HoverMorphIcon idle={QrCode} active={ScanLine} size={16} hovered={qrGroupHovered} />
                  </span>
                  <span className="flex-1">QR Short Links</span>
                  {qrShortLinksOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {qrShortLinksOpen && (
                <div className="ml-3 space-y-1.5 border-l border-sidebar-border pl-3">
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
          {/* Unified profile card — a bordered card (name/role + avatar in a gradient ring, like
              the reference) triggers a menu that now holds Configuración and Cerrar sesión both,
              replacing the separate standalone nav item + sign-out button + bare dropdown. */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex w-full items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/30 p-3 text-left outline-hidden hover:border-sidebar-border hover:bg-sidebar-accent/60 data-[popup-open]:border-sidebar-border data-[popup-open]:bg-sidebar-accent/60">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-sidebar-foreground">{email}</span>
                  <span className="block truncate text-xs text-sidebar-muted-foreground">{role}</span>
                </span>
                <span className="shrink-0 rounded-full bg-gradient-to-br from-primary via-accent to-secondary p-0.5">
                  <Avatar size="lg" className="bg-sidebar">
                    <AvatarFallback className="bg-transparent">{initials(email)}</AvatarFallback>
                  </Avatar>
                </span>
              </DropdownMenuTrigger>
              {/* No fixed width — the shared component's default (w-(--anchor-width)) matches
                  the trigger's own width, keeping the popup inside the sidebar instead of
                  overflowing past its right border like a fixed w-64 did. */}
              <DropdownMenuContent side="top" align="start">
                <div className="flex items-center gap-3 p-2">
                  <span className="shrink-0 rounded-full bg-gradient-to-br from-primary via-accent to-secondary p-0.5">
                    <Avatar className="bg-popover">
                      <AvatarFallback className="bg-transparent">{initials(email)}</AvatarFallback>
                    </Avatar>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{email}</span>
                    <span className="block truncate text-xs text-muted-foreground">{role}</span>
                  </span>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<Link href="/settings" />}
                  onMouseEnter={() => setSettingsHovered(true)}
                  onMouseLeave={() => setSettingsHovered(false)}
                >
                  <HoverMorphIcon idle={Settings} active={Settings2} size={16} hovered={settingsHovered} />
                  Configuración
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
