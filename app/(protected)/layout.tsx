import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, getOrganization } from "@/modules/users";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { Breadcrumb } from "./breadcrumb";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !isActive(user.profile)) {
    redirect("/login");
  }

  const organization = await getOrganization(user.profile.organizationId);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar email={user.email} role={user.profile.role} />
      <main className="flex-1 overflow-y-auto md:bg-sidebar md:p-2">
        <div className="content-frame flex h-full flex-col overflow-hidden rounded-xl bg-background">
          <header className="flex h-14 items-center px-4 md:h-16 md:px-6">
            <Breadcrumb orgName={organization?.name ?? "Marketing Hub"} />
          </header>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </main>
    </SidebarProvider>
  );
}
