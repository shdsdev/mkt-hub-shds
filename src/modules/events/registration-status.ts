export type RegistrationStatus = "confirmed" | "waitlisted" | "cancelled" | "checked_in";

export function getEffectiveRegistrationStatus(
  status: RegistrationStatus,
  attendees: readonly { checkedInAt: Date | null }[],
): RegistrationStatus {
  if (status !== "confirmed" && status !== "checked_in") return status;

  const primaryCheckedIn = Boolean(attendees[0]?.checkedInAt);
  const everyoneCheckedIn = attendees.length > 0 && attendees.every((attendee) => Boolean(attendee.checkedInAt));

  if (everyoneCheckedIn) return "checked_in";
  if (primaryCheckedIn) return "confirmed";
  return "confirmed";
}
