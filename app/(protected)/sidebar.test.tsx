// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/events") }));
vi.mock("./actions", () => ({ signOutAction: vi.fn() }));
vi.mock("./settings/actions", () => ({ updateUserThemeAction: vi.fn() }));
vi.mock("@/components/hover-morph-icon", () => ({ HoverMorphIcon: () => null }));
vi.mock("@/modules/users", () => ({
  DEFAULT_THEME_ID: "carbon",
  THEMES: [
    { id: "light", mode: "light" },
    { id: "dark", mode: "dark" },
    { id: "carbon", mode: "light" },
    { id: "lark-orange", mode: "dark" },
    { id: "midnight", mode: "dark" },
  ],
}));
vi.mock("@/components/ui/theme-switch", () => ({
  default: ({ targetThemeId }: { targetThemeId: string }) => <span data-theme-target={targetThemeId}>Apariencia</span>,
}));
vi.mock("@/components/ui/sidebar", () => {
  const wrapper = ({ children, render, isActive, className }: { children?: ReactNode; render?: ReactNode; isActive?: boolean; className?: string }) => <div className={className} data-active={isActive}>{render}{children}</div>;
  return Object.fromEntries([
    "Sidebar", "SidebarContent", "SidebarFooter", "SidebarGroup", "SidebarGroupContent",
    "SidebarGroupLabel", "SidebarHeader", "SidebarMenu", "SidebarMenuButton", "SidebarMenuItem", "SidebarTrigger",
    "SidebarMenuSub", "SidebarMenuSubButton", "SidebarMenuSubItem",
  ].map((name) => [name, wrapper]));
});
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ui/dropdown-menu", () => {
  const wrapper = ({ children, render }: { children?: ReactNode; render?: ReactNode }) => <div>{render}{children}</div>;
  return Object.fromEntries([
    "DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "DropdownMenuTrigger",
  ].map((name) => [name, wrapper]));
});

import { AppSidebar, MobileBottomNav } from "./sidebar";

describe("sidebar role visibility", () => {
  it.each([
    ["/qr", "/qr"],
    ["/qr/example", "/qr"],
    ["/qr/quick", "/qr/quick"],
    ["/qr/quick/example", "/qr/quick"],
  ])("marks only %s's matching QR subitem as current", async (pathname, currentHref) => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () => root.render(<AppSidebar email="admin@example.com" role="ADMIN" targetThemeId="carbon" />));
      const subitems = Array.from(container.querySelectorAll('a[href="/qr"], a[href="/qr/quick"]'));
      expect(subitems).toHaveLength(2);
      const active = subitems.filter((link) => link.parentElement?.getAttribute("data-active") === "true");
      expect(active.map((link) => link.getAttribute("href"))).toEqual([currentHref]);
      expect(container.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe(currentHref);
      const group = Array.from(container.querySelectorAll("[data-active]")).find((element) => element.textContent === "QR Short Links");
      expect(group?.classList.contains("data-active:bg-accent")).toBe(true);
      expect(group?.classList.contains("data-active:text-white")).toBe(true);
    } finally {
      await act(async () => root.unmount());
      vi.mocked(usePathname).mockReturnValue("/events");
      vi.unstubAllGlobals();
    }
  });

  it.each(["RECEPTION", "EVENT_EDITOR"])("shows only the events module for %s", (role) => {
    const html = renderToStaticMarkup(<AppSidebar email="user@example.com" role={role} targetThemeId="dark" />);
    expect(html).toContain('href="/events"');
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain("user@example.com");
    for (const href of ["/", "/notifications", "/campaigns", "/audit", "/settings", "/settings/users"]) {
      expect(html).not.toContain(`href="${href}"`);
    }
    expect(html).not.toContain("QR Short Links");
  });

  it("preserves administrator modules and settings", () => {
    const html = renderToStaticMarkup(<AppSidebar email="admin@example.com" role="ADMIN" targetThemeId="dark" />);
    for (const href of ["/", "/notifications", "/events", "/campaigns", "/audit", "/settings", "/settings/users"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("QR Short Links");
  });

  it("offers Lark Orange from Carbon", () => {
    const html = renderToStaticMarkup(<AppSidebar email="user@example.com" role="RECEPTION" targetThemeId="lark-orange" targetThemeMode="dark" />);
    expect(html).toContain('data-theme-target="lark-orange"');
  });

  it("offers Carbon from Lark Orange", () => {
    const html = renderToStaticMarkup(<AppSidebar email="user@example.com" role="EVENT_EDITOR" targetThemeId="carbon" targetThemeMode="light" />);
    expect(html).toContain('data-theme-target="carbon"');
  });

  it("offers Carbon to admins using a special dark theme", () => {
    const html = renderToStaticMarkup(<AppSidebar email="admin@example.com" role="ADMIN" targetThemeId="carbon" targetThemeMode="light" />);
    expect(html).toContain('data-theme-target="carbon"');
  });

  it("shows the mobile primary destinations for full-access roles", () => {
    const html = renderToStaticMarkup(<MobileBottomNav role="ADMIN" />);

    expect(html).toContain('href="/events"');
    expect(html).toContain('href="/qr"');
    expect(html).toContain("Qr Short");
    expect(html).toContain("Más");
    expect(html).toContain("xl:hidden");
    expect(html).toContain("bg-accent");
  });

  it.each(["RECEPTION", "EVENT_EDITOR"])("shows only Eventos for %s on mobile", (role) => {
    const html = renderToStaticMarkup(<MobileBottomNav role={role} />);

    expect(html).toContain('href="/events"');
    expect(html).toContain("w-32");
    expect(html).not.toContain('href="/qr"');
    expect(html).not.toContain("Qr Short");
    expect(html).not.toContain("Más");
  });
});
