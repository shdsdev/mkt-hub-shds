"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const GENERIC_SUCCESS =
  "Si el correo está registrado, recibirás un enlace para crear tu contraseña.";

export type PasswordRecoveryFormState = { error?: string; success?: string };

const emailSchema = z.string().trim().email().max(254);

export async function requestPasswordRecovery(
  _state: PasswordRecoveryFormState,
  formData: FormData,
): Promise<PasswordRecoveryFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Ingresa un correo electrónico válido." };

  const headerStore = await headers();
  const host = headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo = new URL("/auth/callback", origin);
  redirectTo.searchParams.set("next", "/password-setup");

  await (await createClient()).auth.resetPasswordForEmail(parsed.data, {
    redirectTo: redirectTo.toString(),
  });

  return { success: GENERIC_SUCCESS };
}
