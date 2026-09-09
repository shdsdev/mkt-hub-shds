"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { createDynamicQrCode, createStaticQrCode, archiveQrCode } from "@/modules/qr";
import { createLink, createShortLink, listDomains } from "@/modules/links";
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

const createWebsiteQrSchema = z
  .object({ destinationUrl: z.string().trim().min(1).max(2048) })
  .merge(customizationSchema);

export type CreateWebsiteQrFormState = { error?: string; qrCodeId?: string };

// One-step "Sitio web" flow (2026-09-09 design): creates the link, short link (auto-slug, on the
// organization's first domain), and QR code together — no separate "create a short link first"
// step. Sequential inserts, no db.transaction() wrapping them (the rest of the codebase doesn't
// use transactions either); a failure between steps can leave an orphaned link/short-link with no
// QR, an accepted low-probability simplification consistent with existing conventions.
export async function createWebsiteQrCodeAction(
  _prevState: CreateWebsiteQrFormState,
  formData: FormData,
): Promise<CreateWebsiteQrFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) {
    return { error: RATE_LIMIT_ERROR };
  }

  const parsed = createWebsiteQrSchema.safeParse({
    destinationUrl: formData.get("destinationUrl"),
    backgroundColor: formData.get("backgroundColor"),
    foregroundColor: formData.get("foregroundColor"),
    errorCorrectionLevel: formData.get("errorCorrectionLevel"),
    logoUrl: formData.get("logoUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: "Enter a valid destination URL and colors." };
  }

  const domains = await listDomains(user.profile.organizationId);
  const domain = domains[0];
  if (!domain) {
    return { error: "Add a domain on the Links page first." };
  }

  let qrCode;
  try {
    const link = await createLink({
      organizationId: user.profile.organizationId,
      destinationUrl: parsed.data.destinationUrl,
    });
    const shortLink = await createShortLink({
      organizationId: user.profile.organizationId,
      linkId: link.id,
      domainId: domain.id,
    });
    qrCode = await createDynamicQrCode({
      organizationId: user.profile.organizationId,
      linkId: link.id,
      shortLinkId: shortLink.id,
      backgroundColor: parsed.data.backgroundColor,
      foregroundColor: parsed.data.foregroundColor,
      errorCorrectionLevel: parsed.data.errorCorrectionLevel,
      logoUrl: parsed.data.logoUrl || undefined,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create QR code." };
  }

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "create",
    resourceType: "qr_code",
    resourceId: qrCode.id,
    after: qrCode,
  });

  revalidatePath("/qr");
  return { qrCodeId: qrCode.id };
}

const createStaticSchema = z
  .object({ payload: z.string().trim().min(1).max(2048) })
  .merge(customizationSchema);

export type CreateStaticQrFormState = { error?: string; qrCodeId?: string };

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
  return { qrCodeId: qrCode.id };
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
