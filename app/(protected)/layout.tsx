import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, signOut } from "@/modules/auth";
import { isActive } from "@/modules/users";

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
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <nav className="flex items-center gap-6">
          <span className="font-heading font-semibold">Marketing Hub</span>
          <Link href="/links" className="text-sm text-muted-foreground hover:text-foreground">
            Links
          </Link>
          <Link href="/qr" className="text-sm text-muted-foreground hover:text-foreground">
            QR Codes
          </Link>
          <Link href="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">
            Campaigns
          </Link>
        </nav>
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
      <main className="p-6">{children}</main>
    </div>
  );
}
