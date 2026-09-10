import { createClient } from "@/lib/supabase/server";
import {
  getProfile,
  getAuthUserIdByEmail,
  updateLockoutState,
  isActive,
  type Profile,
} from "@/modules/users";
import { isLockedOut, recordFailedAttempt, recordSuccessfulLogin } from "./lockout";

const GENERIC_AUTH_ERROR = "Correo electrónico o contraseña inválidos.";
const LOCKED_ERROR = "Demasiados intentos fallidos. Inténtalo de nuevo más tarde.";
const DISABLED_ERROR = "Esta cuenta fue deshabilitada.";

export type SignInResult = { success: true } | { success: false; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const now = new Date();
  const authUserId = await getAuthUserIdByEmail(email);
  const profile = authUserId ? await getProfile(authUserId) : undefined;

  if (profile && isLockedOut(profile, now)) {
    return { success: false, error: LOCKED_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (profile) {
      const next = recordFailedAttempt(profile, now);
      await updateLockoutState(profile.id, next);
    }
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  if (profile) {
    if (!isActive(profile)) {
      await supabase.auth.signOut();
      return { success: false, error: DISABLED_ERROR };
    }
    await updateLockoutState(profile.id, recordSuccessfulLogin());
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export type CurrentUser = { id: string; email: string; profile: Profile };

export async function getCurrentUser(): Promise<CurrentUser | undefined> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return undefined;

  const profile = await getProfile(user.id);
  if (!profile) return undefined;

  return { id: user.id, email: user.email, profile };
}
