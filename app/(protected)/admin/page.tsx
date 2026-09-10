import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isAdmin } from "@/modules/users";

// Proves the coarse ADMIN-vs-rest gate (SPEC.md §19, ROADMAP.md Phase 1 acceptance criteria).
export default async function AdminOnlyPage() {
  const user = await getCurrentUser();

  if (!user || !isAdmin(user.profile)) {
    notFound();
  }

  return (
    <div>
      <h1 className="font-heading text-xl font-semibold">Administración</h1>
      <p className="text-muted-foreground">
        Solo el rol ADMIN llega a esta página — para cualquier otro rol es un 404.
      </p>
    </div>
  );
}
