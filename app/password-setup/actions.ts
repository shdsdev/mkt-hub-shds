"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PasswordSetupFormState = { error?: string };

const passwordSchema = z
  .object({
    password: z.string().min(12).max(200),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
  });

export async function setInvitationPassword(
  _state: PasswordSetupFormState,
  formData: FormData,
): Promise<PasswordSetupFormState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: "La contraseña debe tener al menos 12 caracteres y coincidir." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "La invitación no es válida o expiró." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "No se pudo actualizar la contraseña. Inténtalo de nuevo." };
  }

  redirect("/");
}