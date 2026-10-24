import { listAccessibleEvents } from "@/modules/events";
import type { CurrentUser } from "@/modules/auth";

export async function getLoginDestination(
  user: CurrentUser | undefined,
  fallback: string,
): Promise<string> {
  if (user?.profile.role !== "RECEPTION") return fallback;

  const events = await listAccessibleEvents({
    organizationId: user.profile.organizationId,
    userId: user.id,
    role: user.profile.role,
  });
  return events.length === 1 ? `/events/${events[0].id}/dashboard` : "/events";
}
