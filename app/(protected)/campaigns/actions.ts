"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { createCampaign, endCampaign } from "@/modules/campaigns";

const createCampaignSchema = z.object({ name: z.string().trim().min(1).max(255) });

export type CreateCampaignFormState = { error?: string };

export async function createCampaignAction(
  _prevState: CreateCampaignFormState,
  formData: FormData,
): Promise<CreateCampaignFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = createCampaignSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: "Enter a campaign name." };
  }

  await createCampaign(user.profile.organizationId, parsed.data.name);
  revalidatePath("/campaigns");
  return {};
}

export async function endCampaignAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const campaignId = z.string().uuid().parse(formData.get("campaignId"));
  await endCampaign(campaignId);
  revalidatePath("/campaigns");
}
