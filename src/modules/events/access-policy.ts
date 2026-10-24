import type { UserRole } from "@/modules/users";

export type EventCapability =
  | "registrations"
  | "check-in"
  | "internal-form"
  | "edit"
  | "raffle"
  | "questions"
  | "dashboard"
  | "benefit-redemption"
  | "benefit-management";

export function canRoleAccessCapability(role: UserRole, capability: EventCapability): boolean {
  if (role === "ADMIN") return true;
  if (role === "EVENT_EDITOR") return true;
  return role === "RECEPTION" && (capability === "registrations" || capability === "check-in" || capability === "internal-form" || capability === "dashboard" || capability === "benefit-redemption");
}
