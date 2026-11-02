export type EmailCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed";

const transitions: Record<EmailCampaignStatus, readonly EmailCampaignStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["sending", "cancelled"],
  sending: ["sent", "failed"],
  sent: [],
  cancelled: [],
  failed: ["sending", "cancelled"],
};

export function transitionEmailCampaignStatus(
  current: EmailCampaignStatus,
  next: EmailCampaignStatus,
): EmailCampaignStatus {
  if (!transitions[current].includes(next)) {
    throw new Error(`Invalid email campaign transition: ${current} -> ${next}`);
  }
  return next;
}
