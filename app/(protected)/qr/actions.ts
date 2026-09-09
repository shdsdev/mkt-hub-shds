"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { createDynamicQrCode, createStaticQrCode, archiveQrCode } from "@/modules/qr";
import { listShortLinksForOrganization } from "@/modules/links";
import { recordAudit, checkRateLimit } from "@/modules/audit";

const RATE_LIMIT_ERROR = "Too many actions. Try again shortly.";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #1c130f.");
const ecLevel = z.enum(["L", "M", "Q", "H"]);

const customizationSchema = z.object({
  backgroundColor: hexColor,
  foregroundColor: hexColor,
  errorCorrectionLevel: ecLevel,
  logoUrl: z.string().url().optional().or(z.literal("")),
});

const createDynamicSchema = z
  .object({ shortLinkId: z.string().uuid() })
  .merge(customizationSchema);

export type CreateDynamicQrFormState = { error?: string };

export async function createDynamicQrCodeAction(
  _prevState: CreateDynamicQrFormState,
  formData: FormData,
): Promise<CreateDynamicQrFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = createDynamicSchema.safeParse({
    shortLinkId: formData.get("shortLinkId"),
    backgroundColor: formData.get("backgroundColor"),
    foregroundColor: formData.get("foregroundColor"),
    errorCorrectionLevel: formData.get("errorCorrectionLevel"),
    logoUrl: formData.get("logoUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: "Pick a short link and valid colors." };
  }

  const shortLinks = await listShortLinksForOrganization(user.profile.organizationId);
  const shortLink = shortLinks.find((s) => s.id === parsed.data.shortLinkId);
  if (!shortLink) {
    return { error: "Short link not found." };
  }

  const qrCode = await createDynamicQrCode({
    organizationId: user.profile.organizationId,
    linkId: shortLink.linkId,
    shortLinkId: shortLink.id,
    backgroundColor: parsed.data.backgroundColor,
    foregroundColor: parsed.data.foregroundColor,
    errorCorrectionLevel: parsed.data.errorCorrectionLevel,
    logoUrl: parsed.data.logoUrl || undefined,
  });
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "qr_code",
    resourceId: qrCode.id,
    after: qrCode,
  });

  revalidatePath("/qr");
  return {};
}

const createStaticSchema = z
  .object({ payload: z.string().trim().min(1).max(2048) })
  .merge(customizationSchema);

export type CreateStaticQrFormState = { error?: string };

export async function createStaticQrCodeAction(
  _prevState: CreateStaticQrFormState,
  formData: FormData,
): Promise<CreateStaticQrFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = createStaticSchema.safeParse({
    payload: formData.get("payload"),
    backgroundColor: formData.get("backgroundColor"),
    foregroundColor: formData.get("foregroundColor"),
    errorCorrectionLevel: formData.get("errorCorrectionLevel"),
    logoUrl: formData.get("logoUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: "Enter a payload and valid colors." };
  }

  const qrCode = await createStaticQrCode({
    organizationId: user.profile.organizationId,
    payload: parsed.data.payload,
    backgroundColor: parsed.data.backgroundColor,
    foregroundColor: parsed.data.foregroundColor,
    errorCorrectionLevel: parsed.data.errorCorrectionLevel,
    logoUrl: parsed.data.logoUrl || undefined,
  });
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "qr_code",
    resourceId: qrCode.id,
    after: qrCode,
  });

  revalidatePath("/qr");
  return {};
}

export async function archiveQrCodeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const id = z.string().uuid().parse(formData.get("id"));
  await archiveQrCode(id);
  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "archive",
    resourceType: "qr_code",
    resourceId: id,
  });
  revalidatePath("/qr");
}
