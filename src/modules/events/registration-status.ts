export type RegistrationStatus = "pending_review" | "confirmed" | "waitlisted" | "rejected" | "cancelled" | "checked_in";

export function getEffectiveRegistrationStatus(
  status: RegistrationStatus,
  attendees: readonly { checkedInAt: Date | null; isPrimary?: boolean }[],
): RegistrationStatus {
  if (status !== "confirmed" && status !== "checked_in") return status;

  const primaryCheckedIn = Boolean(attendees.find((attendee) => attendee.isPrimary)?.checkedInAt);
  const everyoneCheckedIn = attendees.length > 0 && attendees.every((attendee) => Boolean(attendee.checkedInAt));

  if (everyoneCheckedIn) return "checked_in";
  if (primaryCheckedIn) return "confirmed";
  return "confirmed";
}
