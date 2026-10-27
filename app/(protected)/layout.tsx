import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { DEFAULT_THEME_ID, THEMES, isActive } from "@/modules/users";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, MobileBottomNav, ProfileMenu } from "./sidebar";
import { Breadcrumb } from "./breadcrumb";
import { GradientBorderToggle } from "./gradient-border-toggle";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !isActive(user.profile)) {
    redirect("/login");
  }
  const currentTheme = THEMES.find((item) => item.id === user.profile.theme)
    ?? THEMES.find((item) => item.id === DEFAULT_THEME_ID)!;
  const targetThemeId = currentTheme.mode === "dark" ? "light" : "dark";

  return (
    <SidebarProvider className="app-shell h-svh overflow-hidden">
      <AppSidebar email={user.email} role={user.profile.role} targetThemeId={targetThemeId} />
      <main className="min-w-0 flex-1 overflow-y-auto xl:bg-sidebar xl:p-2">
        <div className="content-frame gradient-border-frame flex h-full min-w-0 flex-col overflow-hidden rounded-xl bg-background">
          <header className="flex h-14 items-center justify-between px-4 md:h-16 md:px-6">
            <Breadcrumb />
            <div className="flex items-center gap-2">
              <div className="xl:hidden">
                <ProfileMenu email={user.email} role={user.profile.role} targetThemeId={targetThemeId} compact />
              </div>
              <GradientBorderToggle />
            </div>
          </header>
          <div className="min-w-0 flex-1 overflow-y-auto p-6 pb-28 xl:pb-6">{children}</div>
        </div>
      </main>
      <MobileBottomNav role={user.profile.role} />
    </SidebarProvider>
  );
}
