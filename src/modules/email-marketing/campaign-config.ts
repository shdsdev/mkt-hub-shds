export type CampaignSendMode = "draft" | "now" | "scheduled";

export function parseCampaignSchedule(
  input: { sendMode: CampaignSendMode; scheduledAt?: string | null },
  now = new Date(),
): { status: "draft" | "scheduled"; scheduledAt: Date | null } {
  if (input.sendMode === "draft") return { status: "draft", scheduledAt: null };
  if (input.sendMode === "now") return { status: "scheduled", scheduledAt: now };

  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) {
    throw new Error("Scheduled campaign must be set for a future time.");
  }
  return { status: "scheduled", scheduledAt };
}
