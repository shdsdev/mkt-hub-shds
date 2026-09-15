"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { updateTheme, isValidThemeId, updateDefaultLogo } from "@/modules/users";
import { checkRateLimit } from "@/modules/audit";

export async function updateUserThemeAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const themeId = z.string().min(1).parse(formData.get("themeId"));
  if (!isValidThemeId(themeId)) return;

  await updateTheme(user.id, themeId);
  revalidatePath("/", "layout");
}

// Org-wide (not per-user) — pre-fills into every new QR code's logo step (create-qr-modal.tsx).
export async function updateDefaultLogoAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!checkRateLimit(user.id)) return;

  const url = formData.get("logoUrl");
  await updateDefaultLogo(user.profile.organizationId, typeof url === "string" && url ? url : null);
  revalidatePath("/settings");
}
