"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { updateTheme, isValidThemeId } from "@/modules/users";
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
