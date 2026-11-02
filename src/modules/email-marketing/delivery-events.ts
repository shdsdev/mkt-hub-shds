export type RecipientDeliveryStatus = "delivered" | "bounced" | "suppressed" | "failed";

export function getRecipientDeliveryStatus(eventType: string): RecipientDeliveryStatus | null {
  if (eventType === "email.delivered") return "delivered";
  if (eventType === "email.bounced") return "bounced";
  if (eventType === "email.suppressed" || eventType === "email.complained") return "suppressed";
  if (eventType === "email.failed") return "failed";
  return null;
}
