import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isAdmin } from "@/modules/users";

export default async function EmailMarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.profile)) redirect("/");

  return children;
}
