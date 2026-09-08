import { getCurrentUser } from "@/modules/auth";

export default async function DashboardPlaceholder() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="font-heading text-xl font-semibold">Welcome</h1>
      <p className="text-muted-foreground">
        Signed in as {user?.email} ({user?.profile.role}). The real dashboard lands in Phase 8.
      </p>
    </div>
  );
}
