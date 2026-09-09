import { redirect } from "next/navigation";
import { getCurrentUser, signOut } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { Sidebar } from "./sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !isActive(user.profile)) {
    redirect("/login");
  }

  async function logout() {
    "use server";
    await signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="font-heading font-semibold">Marketing Hub</span>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {user.email} · {user.profile.role}
            </span>
            <form action={logout}>
              <button type="submit" className="text-accent hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
