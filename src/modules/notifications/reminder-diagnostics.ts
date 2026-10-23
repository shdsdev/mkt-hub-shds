import { notificationStatus } from "./db";

type ReminderStatus = (typeof notificationStatus.enumValues)[number] | undefined;

export type ReminderStatusSummary = {
  total: number;
  missing: number;
  pending: number;
  failed: number;
  sent: number;
  blocked: number;
};

export function summarizeReminderStatuses(
  statuses: Array<{ attendeeId: string; status: ReminderStatus }>,
): ReminderStatusSummary {
  const summary: ReminderStatusSummary = {
    total: statuses.length,
    missing: 0,
    pending: 0,
    failed: 0,
    sent: 0,
    blocked: 0,
  };

  for (const { status } of statuses) {
    if (status === undefined) summary.missing += 1;
    else if (status === "pending") summary.pending += 1;
    else if (status === "failed") summary.failed += 1;
    else if (status === "sent") summary.sent += 1;

    if (status !== undefined && status !== "sent") summary.blocked += 1;
  }

  return summary;
}
