export type DeliveryRecipientStatus = "pending" | "sent" | "delivered" | "bounced" | "failed" | "suppressed";

export type EmailCampaignDeliverySummary = {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  delayed: number;
  bounced: number;
  failed: number;
  suppressed: number;
};

export function summarizeRecipientStatuses(
  rows: readonly { status: DeliveryRecipientStatus; count: number }[],
): EmailCampaignDeliverySummary {
  const summary: EmailCampaignDeliverySummary = {
    total: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    delayed: 0,
    bounced: 0,
    failed: 0,
    suppressed: 0,
  };

  for (const row of rows) {
    summary[row.status] += row.count;
    summary.total += row.count;
  }

  return summary;
}
