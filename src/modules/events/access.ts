import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { isAdmin, type UserRole } from "@/modules/users";
import { getEvent } from "./service";
import { eventEditors, eventReceptionists } from "./db";
import { canRoleAccessCapability, type EventCapability } from "./access-policy";

export { canRoleAccessCapability, type EventCapability } from "./access-policy";

export async function canAccessEvent(input: {
  userId: string;
  organizationId: string;
  role: UserRole;
  eventId: string;
  capability: EventCapability;
}): Promise<boolean> {
  if (!canRoleAccessCapability(input.role, input.capability)) return false;
  if (!(await getEvent(input.eventId, input.organizationId))) return false;
  if (isAdmin({ role: input.role })) return true;

  const assignments = input.role === "EVENT_EDITOR" ? eventEditors : eventReceptionists;
  const [assignment] = await db
    .select({ userId: assignments.userId })
    .from(assignments)
    .where(and(eq(assignments.eventId, input.eventId), eq(assignments.userId, input.userId)))
    .limit(1);

  return Boolean(assignment);
}
