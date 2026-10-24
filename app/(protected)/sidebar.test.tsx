import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/events" }));
vi.mock("./actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/components/hover-morph-icon", () => ({ HoverMorphIcon: () => null }));
vi.mock("@/components/ui/sidebar", () => {
  const wrapper = ({ children, render }: { children?: ReactNode; render?: ReactNode }) => <div>{render}{children}</div>;
  return Object.fromEntries([
    "Sidebar", "SidebarContent", "SidebarFooter", "SidebarGroup", "SidebarGroupContent",
    "SidebarGroupLabel", "SidebarHeader", "SidebarMenu", "SidebarMenuButton", "SidebarMenuItem",
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

import { AppSidebar } from "./sidebar";

describe("sidebar role visibility", () => {
  it.each(["RECEPTION", "EVENT_EDITOR"])("shows only the events module for %s", (role) => {
    const html = renderToStaticMarkup(<AppSidebar email="user@example.com" role={role} />);
    expect(html).toContain('href="/events"');
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain("user@example.com");
    for (const href of ["/", "/notifications", "/campaigns", "/audit", "/settings", "/settings/users"]) {
      expect(html).not.toContain(`href="${href}"`);
    }
    expect(html).not.toContain("QR Short Links");
  });

  it("preserves administrator modules and settings", () => {
    const html = renderToStaticMarkup(<AppSidebar email="admin@example.com" role="ADMIN" />);
    for (const href of ["/", "/notifications", "/events", "/campaigns", "/audit", "/settings", "/settings/users"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("QR Short Links");
  });
});
