"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, signIn } from "@/modules/auth";
import { getLoginDestination } from "../auth/login-destination";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export type LoginFormState = { error?: string };

export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Correo electrónico o contraseña inválidos." };
  }

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.success) {
    return { error: result.error };
  }

  const user = await getCurrentUser();
  redirect(await getLoginDestination(user, "/"));
}
