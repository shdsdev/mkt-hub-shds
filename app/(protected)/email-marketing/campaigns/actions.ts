"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { isAdmin } from "@/modules/users";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import {
  createEmailCampaign,
  parseEmailCampaignContent,
  renderEmailHtml,
} from "@/modules/email-marketing";

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(255),
  subject: z.string().trim().min(1).max(255),
  content: z.string().min(2),
});

export type CreateEmailCampaignFormState = {
  error?: string;
  success?: string;
};

export async function createEmailCampaignAction(
  _previousState: CreateEmailCampaignFormState,
  formData: FormData,
): Promise<CreateEmailCampaignFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!isAdmin(user.profile)) return { error: "Sólo un administrador puede crear campañas." };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    subject: formData.get("subject"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "Completá el nombre, el asunto y el contenido de la campaña." };

  let content;
  try {
    content = parseEmailCampaignContent(JSON.parse(parsed.data.content));
  } catch {
    return { error: "El contenido de la campaña no es válido." };
  }

  const campaign = await createEmailCampaign({
    organizationId: user.profile.organizationId,
    createdBy: user.id,
    name: parsed.data.name,
    subject: parsed.data.subject,
    content,
    htmlSnapshot: renderEmailHtml(content),
  });

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "email_campaign",
    resourceId: campaign.id,
    after: campaign,
  });

  revalidatePath("/email-marketing");
  return { success: "Borrador guardado." };
}
