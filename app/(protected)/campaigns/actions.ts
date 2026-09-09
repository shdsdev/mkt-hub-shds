"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { createCampaign, endCampaign } from "@/modules/campaigns";
import { recordAudit, checkRateLimit } from "@/modules/audit";

const RATE_LIMIT_ERROR = "Too many actions. Try again shortly.";

const createCampaignSchema = z.object({ name: z.string().trim().min(1).max(255) });

export type CreateCampaignFormState = { error?: string };

export async function createCampaignAction(
  _prevState: CreateCampaignFormState,
  formData: FormData,
): Promise<CreateCampaignFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = createCampaignSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "Enter a campaign name." };
  }

  const campaign = await createCampaign(user.profile.organizationId, parsed.data.name);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "campaign",
    resourceId: campaign.id,
    after: campaign,
  });
  revalidatePath("/campaigns");
  return {};
}

export async function endCampaignAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const campaignId = z.string().uuid().parse(formData.get("campaignId"));
  await endCampaign(campaignId);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "end_campaign",
    resourceType: "campaign",
    resourceId: campaignId,
  });
  revalidatePath("/campaigns");
}
