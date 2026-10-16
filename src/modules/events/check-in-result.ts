export type CheckInResultKind = "not_found" | "already_checked_in" | "eligible" | "blocked";

export function getCheckInResultKind(input: {
  registrationStatus: "confirmed" | "waitlisted" | "cancelled" | "checked_in";
  checkedInAt: Date | null;
}): CheckInResultKind {
  if (input.registrationStatus === "cancelled" || input.registrationStatus === "waitlisted") return "blocked";
  if (input.checkedInAt) return "already_checked_in";
  return "eligible";
}
