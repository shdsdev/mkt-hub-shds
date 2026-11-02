export type CampaignSendMode = "draft" | "now" | "scheduled";

export function getCampaignResultRedirect(
  campaignId: string,
  sendMode: CampaignSendMode,
): string | undefined {
  return sendMode === "draft" ? undefined : `/email-marketing/campaigns/${campaignId}`;
}
