import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
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

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar email={user.email} role={user.profile.role} />
      <main className="flex-1 overflow-y-auto md:bg-sidebar md:p-2">
        <div className="content-frame gradient-border-frame flex h-full flex-col overflow-hidden rounded-xl bg-background">
          <header className="flex h-14 items-center justify-between px-4 md:h-16 md:px-6">
            <Breadcrumb />
            <GradientBorderToggle />
          </header>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </main>
    </SidebarProvider>
  );
}
