"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isAdmin } from "@/modules/users";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import { sendViaResend } from "@/modules/notifications";
import { env } from "@/lib/env";
import {
  createEmailCampaign,
  createCampaignRecipientSnapshot,
  getCampaignResultRedirect,
  updateEmailCampaign,
  duplicateEmailCampaign,
  listEmailSegments,
  parseCampaignSchedule,
  parseEmailCampaignContent,
  renderEmailHtml,
} from "@/modules/email-marketing";

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(255),
  subject: z.string().trim().min(1).max(255),
  previewText: z.string().trim().max(255).optional(),
  fromName: z.string().trim().max(120).optional(),
  sendMode: z.enum(["draft", "now", "scheduled"]).default("draft"),
  scheduledAt: z.string().optional(),
  content: z.string().min(2),
  audience: z.string().optional(),
});

export type CreateEmailCampaignFormState = {
  error?: string;
  success?: string;
};

export type SendTestEmailFormState = {
  error?: string;
  success?: string;
};

const campaignUpdateSchema = campaignSchema.extend({ campaignId: z.string().uuid() });

const testEmailSchema = z.object({
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(255),
  content: z.string().min(2),
});

export async function sendTestEmailAction(
  _previousState: SendTestEmailFormState,
  formData: FormData,
): Promise<SendTestEmailFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!isAdmin(user.profile)) return { error: "Sólo un administrador puede enviar pruebas." };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const parsed = testEmailSchema.safeParse({
    email: formData.get("email"),
    subject: formData.get("subject"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "Ingresá un correo válido para enviar la prueba." };

  try {
    const content = parseEmailCampaignContent(JSON.parse(parsed.data.content));
    const sent = await sendViaResend({
      to: parsed.data.email,
      subject: `[Prueba] ${parsed.data.subject}`,
      html: renderEmailHtml(content),
      from: env.RESEND_MARKETING_FROM,
      replyTo: env.RESEND_MARKETING_REPLY_TO || undefined,
    });
    if (!sent.ok) return { error: "No se pudo enviar la prueba. Revisá la configuración de Resend." };
    return { success: `Prueba enviada a ${parsed.data.email}.` };
  } catch {
    return { error: "El contenido de la prueba no es válido." };
  }
}

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
    previewText: formData.get("previewText") || undefined,
    fromName: formData.get("fromName") || undefined,
    sendMode: formData.get("sendMode") || "draft",
    scheduledAt: formData.get("scheduledAt") || undefined,
    content: formData.get("content"),
    audience: formData.get("audience"),
  });
  if (!parsed.success) return { error: "Completá el nombre, el asunto y el contenido de la campaña." };

  let content;
  try {
    content = parseEmailCampaignContent(JSON.parse(parsed.data.content));
  } catch {
    return { error: "El contenido de la campaña no es válido." };
  }

  let audience: { mode: "all" | "segment"; segmentId?: string } = { mode: "all" };
  try {
    audience = z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("all") }),
      z.object({ mode: z.literal("segment"), segmentId: z.string().uuid() }),
    ]).parse(JSON.parse(parsed.data.audience ?? '{"mode":"all"}'));
  } catch {
    return { error: "Seleccioná una audiencia válida." };
  }

  let schedule: ReturnType<typeof parseCampaignSchedule>;
  try {
    schedule = parseCampaignSchedule({ sendMode: parsed.data.sendMode, scheduledAt: parsed.data.scheduledAt });
  } catch {
    return { error: "Elegí una fecha futura para programar la campaña." };
  }

  const campaign = await createEmailCampaign({
    organizationId: user.profile.organizationId,
    createdBy: user.id,
    name: parsed.data.name,
    subject: parsed.data.subject,
    previewText: parsed.data.previewText,
    fromName: parsed.data.fromName,
    content,
    htmlSnapshot: renderEmailHtml(content),
    segmentId: audience.mode === "segment" ? audience.segmentId : undefined,
    status: schedule.status,
    scheduledAt: schedule.scheduledAt,
  });
  const recipientCount = await createCampaignRecipientSnapshot({
    organizationId: user.profile.organizationId,
    campaignId: campaign.id,
    segmentId: audience.mode === "segment" ? audience.segmentId : undefined,
  });
  if (recipientCount === 0) return { error: "La audiencia seleccionada no tiene contactos suscriptos elegibles." };

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "email_campaign",
    resourceId: campaign.id,
    after: campaign,
  });

  revalidatePath("/email-marketing");
  const resultRedirect = getCampaignResultRedirect(campaign.id, parsed.data.sendMode);
  if (resultRedirect) redirect(resultRedirect);
  return { success: `Borrador guardado con ${recipientCount} destinatarios elegibles.` };
}

export async function updateEmailCampaignAction(
  _previousState: CreateEmailCampaignFormState,
  formData: FormData,
): Promise<CreateEmailCampaignFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!isAdmin(user.profile)) return { error: "Sólo un administrador puede editar campañas." };
  if (!checkRateLimit(user.id)) return { error: "Demasiadas acciones. Inténtalo de nuevo en breve." };

  const parsed = campaignUpdateSchema.safeParse({
    campaignId: formData.get("campaignId"),
    name: formData.get("name"),
    subject: formData.get("subject"),
    previewText: formData.get("previewText") || undefined,
    fromName: formData.get("fromName") || undefined,
    sendMode: formData.get("sendMode") || "draft",
    scheduledAt: formData.get("scheduledAt") || undefined,
    content: formData.get("content"),
    audience: formData.get("audience"),
  });
  if (!parsed.success) return { error: "Completá el nombre, el asunto y el contenido de la campaña." };

  let content;
  try {
    content = parseEmailCampaignContent(JSON.parse(parsed.data.content));
  } catch {
    return { error: "El contenido de la campaña no es válido." };
  }

  let audience: { mode: "all" | "segment"; segmentId?: string } = { mode: "all" };
  try {
    audience = z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("all") }),
      z.object({ mode: z.literal("segment"), segmentId: z.string().uuid() }),
    ]).parse(JSON.parse(parsed.data.audience ?? '{"mode":"all"}'));
  } catch {
    return { error: "Seleccioná una audiencia válida." };
  }

  if (audience.mode === "segment") {
    const segments = await listEmailSegments(user.profile.organizationId);
    if (!segments.some((segment) => segment.id === audience.segmentId)) return { error: "El segmento seleccionado no está disponible." };
  }

  let schedule: ReturnType<typeof parseCampaignSchedule>;
  try {
    schedule = parseCampaignSchedule({ sendMode: parsed.data.sendMode, scheduledAt: parsed.data.scheduledAt });
  } catch {
    return { error: "Elegí una fecha futura para programar la campaña." };
  }

  const campaign = await updateEmailCampaign({
    organizationId: user.profile.organizationId,
    campaignId: parsed.data.campaignId,
    name: parsed.data.name,
    subject: parsed.data.subject,
    previewText: parsed.data.previewText,
    fromName: parsed.data.fromName,
    content,
    htmlSnapshot: renderEmailHtml(content),
    segmentId: audience.mode === "segment" ? audience.segmentId : undefined,
    status: schedule.status,
    scheduledAt: schedule.scheduledAt,
  });
  if (!campaign) return { error: "Sólo se pueden editar campañas en borrador." };

  const recipientCount = await createCampaignRecipientSnapshot({
    organizationId: user.profile.organizationId,
    campaignId: campaign.id,
    segmentId: audience.mode === "segment" ? audience.segmentId : undefined,
  });
  if (recipientCount === 0 && parsed.data.sendMode !== "draft") {
    return { error: "La audiencia seleccionada no tiene contactos suscriptos elegibles." };
  }

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "email_campaign",
    resourceId: campaign.id,
    after: campaign,
  });
  revalidatePath("/email-marketing");
  revalidatePath(`/email-marketing/campaigns/${campaign.id}`);
  const resultRedirect = getCampaignResultRedirect(campaign.id, parsed.data.sendMode);
  if (resultRedirect) redirect(resultRedirect);
  return { success: "Cambios guardados." };
}

export async function duplicateEmailCampaignAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.profile)) redirect("/email-marketing");
  if (!checkRateLimit(user.id)) redirect("/email-marketing");

  const campaignId = z.string().uuid().safeParse(formData.get("campaignId"));
  if (!campaignId.success) redirect("/email-marketing");
  const campaign = await duplicateEmailCampaign({
    organizationId: user.profile.organizationId,
    createdBy: user.id,
    campaignId: campaignId.data,
  });
  if (!campaign) redirect("/email-marketing");

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "email_campaign",
    resourceId: campaign.id,
    after: campaign,
  });
  revalidatePath("/email-marketing");
  redirect(`/email-marketing/campaigns/${campaign.id}`);
}
