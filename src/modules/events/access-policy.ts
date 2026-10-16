import type { UserRole } from "@/modules/users";

export type EventCapability = "registrations" | "check-in" | "internal-form" | "edit" | "raffle" | "questions";

export function canRoleAccessCapability(role: UserRole, capability: EventCapability): boolean {
  if (role === "ADMIN") return true;
  return role === "RECEPTION" && (capability === "registrations" || capability === "check-in" || capability === "questions");
}
