import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin, listManagedUsers } from "@/modules/users";
import { UserManagement } from "./user-management";

export default async function UsersSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const users = await listManagedUsers(user.profile.organizationId);
  return <UserManagement users={users} />;
}
