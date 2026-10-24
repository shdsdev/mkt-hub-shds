"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/modules/auth";
import { isActive } from "@/modules/users";
import { markUserNotificationRead } from "@/modules/notifications";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.profile.role === "RECEPTION" || !isActive(user.profile)) return;
  const notificationId = String(formData.get("notificationId") ?? "");
  if (!notificationId) return;

  await markUserNotificationRead({
    id: notificationId,
    userId: user.id,
    organizationId: user.profile.organizationId,
  });
  revalidatePath("/notifications");
}
