"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays as CalendarDaysIcon, ChevronDown, ChevronRight, MoreHorizontal as MoreHorizontalIcon, Moon, QrCode as QrCodeIcon, Sun } from "lucide-react";
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
  Calendar,
  CalendarDays,
  Bell,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
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
import { updateUserThemeAction } from "./settings/actions";

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

export function ProfileMenu({
  email,
  role,
  targetThemeId,
  compact = false,
}: {
  email: string;
  role: string;
  targetThemeId: "light" | "dark";
  compact?: boolean;
}) {
  const [signOutHovered, setSignOutHovered] = useState(false);
  const [settingsHovered, setSettingsHovered] = useState(false);
  const eventsOnly = role === "EVENT_EDITOR" || role === "RECEPTION";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menú de perfil"
        className={compact
          ? "group flex size-11 items-center justify-center rounded-full border border-border bg-card p-0.5 text-left outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/50"
          : "group flex w-full items-center gap-3 rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/30 p-3 text-left outline-none hover:border-sidebar-border hover:bg-sidebar-accent/60 data-[popup-open]:border-sidebar-border data-[popup-open]:bg-sidebar-accent/60"}
      >
        <span className={compact ? "rounded-full bg-gradient-to-br from-primary via-accent to-secondary p-0.5" : "min-w-0 flex-1"}>
          {compact ? (
            <Avatar className="bg-sidebar">
              <AvatarFallback className="bg-transparent text-xs">{initials(email)}</AvatarFallback>
            </Avatar>
          ) : (
            <>
              <span className="block truncate text-sm font-semibold text-sidebar-foreground">{email}</span>
              <span className="block truncate text-xs text-sidebar-muted-foreground">{role}</span>
            </>
          )}
        </span>
        {!compact ? (
          <span className="shrink-0 rounded-full bg-gradient-to-br from-primary via-accent to-secondary p-0.5">
            <Avatar size="lg" className="bg-sidebar">
              <AvatarFallback className="bg-transparent">{initials(email)}</AvatarFallback>
            </Avatar>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={compact ? "bottom" : "top"}
        align={compact ? "end" : "start"}
        className={compact ? "w-64 min-w-64 border-white/10 bg-[#111111] p-2 text-[#f5f5f5] dark:border-border dark:bg-popover dark:text-popover-foreground" : undefined}
      >
        <div className="flex items-center gap-3 p-3">
          <span className="shrink-0 rounded-full bg-gradient-to-br from-primary via-accent to-secondary p-0.5">
            <Avatar className={compact ? "bg-[#111111]" : "bg-popover"}>
              <AvatarFallback className="bg-transparent">{initials(email)}</AvatarFallback>
            </Avatar>
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm font-semibold ${compact ? "text-[#f5f5f5]" : "text-foreground"}`}>{email}</span>
            <span className={`block truncate text-xs ${compact ? "text-white/60" : "text-muted-foreground"}`}>{role}</span>
          </span>
        </div>
        <DropdownMenuSeparator className={compact ? "bg-white/15" : undefined} />
        <form action={updateUserThemeAction}>
          <input type="hidden" name="themeId" value={targetThemeId} />
          <DropdownMenuItem className="min-h-11 px-3" nativeButton render={<button type="submit" className="w-full" />}>
            {targetThemeId === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            {targetThemeId === "dark" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          </DropdownMenuItem>
        </form>
        {!eventsOnly ? <DropdownMenuSeparator className={compact ? "bg-white/15" : undefined} /> : null}
        {!eventsOnly ? (
          <DropdownMenuItem
            className="min-h-11 px-3"
            render={<Link href="/settings" />}
            onMouseEnter={() => setSettingsHovered(true)}
            onMouseLeave={() => setSettingsHovered(false)}
          >
            <HoverMorphIcon idle={Settings} active={Settings2} size={16} hovered={settingsHovered} />
            Configuración
          </DropdownMenuItem>
        ) : null}
        {!eventsOnly ? <DropdownMenuSeparator className={compact ? "bg-white/15" : undefined} /> : null}
        <form action={signOutAction}>
          <DropdownMenuItem
            className="min-h-11 px-3"
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
  );
}

export function MobileBottomNav({ role }: { role: string }) {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const eventsOnly = role === "EVENT_EDITOR" || role === "RECEPTION";
  const eventsActive = pathname === "/events" || pathname.startsWith("/events/");
  const qrActive = pathname === "/qr" || pathname.startsWith("/qr/");
  const moreActive = !eventsActive && !qrActive;
  const itemClass = "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none";

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardState = () => {
      setKeyboardOpen(window.innerHeight - viewport.height > 150);
    };
    updateKeyboardState();
    viewport.addEventListener("resize", updateKeyboardState);
    return () => viewport.removeEventListener("resize", updateKeyboardState);
  }, []);

  if (keyboardOpen) return null;

  return (
    <nav
      aria-label="Navegación principal móvil"
      className={`${eventsOnly ? "fixed bottom-3 left-1/2 w-32 -translate-x-1/2" : "fixed inset-x-3 bottom-3"} z-40 flex min-h-16 items-center gap-1 rounded-[1.75rem] border border-white/10 bg-[#111111] p-2 text-white shadow-[0_18px_45px_-20px_rgba(0,0,0,0.65)] pb-[calc(0.5rem+env(safe-area-inset-bottom))] xl:hidden dark:bg-[#252525]`}
    >
      <Link href="/events" aria-current={eventsActive ? "page" : undefined} style={eventsActive ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" } : undefined} className={`${itemClass} ${eventsActive ? "bg-accent text-accent-foreground" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
        <CalendarDaysIcon className="size-5" strokeWidth={2} aria-hidden="true" />
        <span>Eventos</span>
      </Link>
      {!eventsOnly ? (
        <Link href="/qr" aria-current={qrActive ? "page" : undefined} style={qrActive ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" } : undefined} className={`${itemClass} ${qrActive ? "bg-accent text-accent-foreground" : "text-white/65 hover:bg-white/10 hover:text-white"}`}>
          <QrCodeIcon className="size-5" strokeWidth={2} aria-hidden="true" />
          <span>Qr Short</span>
        </Link>
      ) : null}
      {!eventsOnly ? (
        <SidebarTrigger
          aria-label="Abrir más opciones"
          aria-pressed={moreActive}
          title="Más"
          style={moreActive ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
          className={`${itemClass} h-auto text-white/65 hover:bg-white/10 hover:text-white ${moreActive ? "bg-accent text-accent-foreground" : ""}`}
        >
          <MoreHorizontalIcon className="size-5" strokeWidth={2} aria-hidden="true" />
          <span>Más</span>
        </SidebarTrigger>
      ) : null}
    </nav>
  );
}

export function AppSidebar({ email, role, targetThemeId }: { email: string; role: string; targetThemeId: "light" | "dark" }) {
  const pathname = usePathname();
  const eventsOnly = role === "EVENT_EDITOR" || role === "RECEPTION";
  const qrShortLinksActive =
    pathname.startsWith("/links") || pathname.startsWith("/qr") || pathname.startsWith("/analytics");
  // Keep the first render structurally identical on the server and client. The pathname can be
  // resolved differently during hydration when a rewrite or browser navigation is involved.
  const [qrShortLinksOpen, setQrShortLinksOpen] = useState(false);
  const [qrGroupHovered, setQrGroupHovered] = useState(false);

  useEffect(() => {
    setQrShortLinksOpen(qrShortLinksActive);
  }, [qrShortLinksActive]);

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="px-4 pt-6 pb-0">
        <span className="font-heading text-lg font-semibold">Marketing Hub</span>
      </SidebarHeader>

      <SidebarContent className="mt-6 gap-6 px-4">
        {!eventsOnly && <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 h-auto px-0 py-1 text-xs text-sidebar-muted">
            General
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              <NavItem href="/" idle={LayoutDashboard} active={Gauge}>
                Resumen
              </NavItem>
              <NavItem href="/notifications" idle={Bell} active={Bell}>
                Notificaciones
              </NavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}

        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1 h-auto px-0 py-1 text-xs text-sidebar-muted">
            Herramientas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {!eventsOnly && <SidebarMenuItem>
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
              </SidebarMenuItem>}
              {!eventsOnly && qrShortLinksOpen && (
                <SidebarMenuItem>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={pathname === "/qr" || pathname.startsWith("/qr/")}
                        render={<Link href="/qr" />}
                      >
                        <HoverMorphIcon idle={ScanLine} active={QrCode} size={16} />
                        <span>Códigos QR</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={pathname === "/analytics" || pathname.startsWith("/analytics/")}
                        render={<Link href="/analytics" />}
                      >
                        <HoverMorphIcon idle={ChartColumn} active={ChartColumnIncreasing} size={16} />
                        <span>Analytics</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              )}
              {!eventsOnly && <NavItem href="/campaigns" idle={Megaphone} active={Volume2}>
                Campañas
              </NavItem>}
              <NavItem href="/events" idle={Calendar} active={CalendarDays}>
                Eventos
              </NavItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!eventsOnly && <SidebarGroup className="p-0">
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
        </SidebarGroup>}
      </SidebarContent>

      <SidebarFooter className="hidden px-4 pb-6 xl:block">
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <ProfileMenu email={email} role={role} targetThemeId={targetThemeId} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
