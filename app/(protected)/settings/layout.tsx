import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isAdmin } from "@/modules/users";
import { SettingsLayout } from "./settings-layout";

export default async function SettingsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Preferencias personales y de tu organización.</p>
      </div>
      <SettingsLayout isAdmin={isAdmin(user.profile)}>{children}</SettingsLayout>
    </div>
  );
}
