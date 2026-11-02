export type CampaignRecipientOutcome = "sent" | "failed" | "pending";

export function resolveCampaignCompletionStatus(
  outcomes: readonly CampaignRecipientOutcome[],
): "sent" | "failed" {
  return outcomes.length === 0 || outcomes.some((outcome) => outcome === "failed") ? "failed" : "sent";
}
