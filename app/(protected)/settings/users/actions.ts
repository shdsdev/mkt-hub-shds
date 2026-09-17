"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit, recordAudit } from "@/modules/audit";
import { getCurrentUser } from "@/modules/auth";
import {
  changeManagedUserRole,
  inviteManagedUser,
  isActive,
  isAdmin,
  setManagedUserStatus,
  type ManagementMutationResult,
  type ManagedRole,
} from "@/modules/users";

const PERMISSION_ERROR = "No tienes permiso para administrar usuarios.";
const RATE_LIMIT_ERROR = "Demasiadas acciones. Inténtalo de nuevo en breve.";
const INVALID_FORM_ERROR = "Los datos del usuario no son válidos.";
const TARGET_UNAVAILABLE_ERROR = "El usuario no está disponible.";
const SELF_DISABLE_ERROR = "No puedes desactivar tu propia cuenta.";
const LAST_ACTIVE_ADMIN_ERROR = "Debe permanecer al menos un administrador activo.";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["ADMIN", "User"]),
});
const targetSchema = z.object({ targetUserId: z.string().uuid() });
const roleChangeSchema = targetSchema.extend({ role: z.enum(["ADMIN", "User"]) });

export type UserManagementFormState = { error?: string; success?: string };

async function requireActiveAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}

function mapMutationFailure(result: Exclude<ManagementMutationResult, { ok: true }>) {
  switch (result.reason) {
    case "self_disable":
      return SELF_DISABLE_ERROR;
    case "last_active_admin":
      return LAST_ACTIVE_ADMIN_ERROR;
    case "target_not_found":
      return TARGET_UNAVAILABLE_ERROR;
  }
}

function revalidateUserManagement() {
  revalidatePath("/settings/users");
  revalidatePath("/settings");
}

export async function inviteUserAction(
  _state: UserManagementFormState,
  formData: FormData,
): Promise<UserManagementFormState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };
  if (!checkRateLimit(user.id)) return { error: RATE_LIMIT_ERROR };

  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const role: ManagedRole = parsed.data.role === "User" ? "MARKETING_USER" : "ADMIN";
  const result = await inviteManagedUser({
    organizationId: user.profile.organizationId,
    email: parsed.data.email,
    role,
    emailRedirectTo: new URL(
      "/auth/callback",
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ).toString(),
  });
  if (!result.ok) return { error: "No se pudo enviar la invitación." };

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "invite_user",
    resourceType: "user",
    resourceId: result.user.id,
    after: { role: result.user.role, status: result.user.status },
  });
  revalidateUserManagement();
  return { success: "Invitación enviada." };
}

export async function changeUserRoleAction(
  _state: UserManagementFormState,
  formData: FormData,
): Promise<UserManagementFormState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };
  if (!checkRateLimit(user.id)) return { error: RATE_LIMIT_ERROR };

  const parsed = roleChangeSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const role: ManagedRole = parsed.data.role === "User" ? "MARKETING_USER" : "ADMIN";
  const result = await changeManagedUserRole({
    organizationId: user.profile.organizationId,
    actorId: user.id,
    targetUserId: parsed.data.targetUserId,
    role,
  });
  if (!result.ok) return { error: mapMutationFailure(result) };

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action: "change_user_role",
    resourceType: "user",
    resourceId: result.user.id,
    before: result.before,
    after: { role: result.user.role, status: result.user.status },
  });
  revalidateUserManagement();
  return { success: "Rol actualizado." };
}

export async function disableUserAction(
  _state: UserManagementFormState,
  formData: FormData,
): Promise<UserManagementFormState> {
  return setUserStatusAction(formData, "disabled", "disable_user", "Usuario deshabilitado.");
}

export async function reactivateUserAction(
  _state: UserManagementFormState,
  formData: FormData,
): Promise<UserManagementFormState> {
  return setUserStatusAction(formData, "active", "reactivate_user", "Usuario reactivado.");
}

async function setUserStatusAction(
  formData: FormData,
  status: "active" | "disabled",
  action: "disable_user" | "reactivate_user",
  success: string,
): Promise<UserManagementFormState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };
  if (!checkRateLimit(user.id)) return { error: RATE_LIMIT_ERROR };

  const parsed = targetSchema.safeParse({ targetUserId: formData.get("targetUserId") });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const result = await setManagedUserStatus({
    organizationId: user.profile.organizationId,
    actorId: user.id,
    targetUserId: parsed.data.targetUserId,
    status,
  });
  if (!result.ok) return { error: mapMutationFailure(result) };

  await recordAudit({
    organizationId: user.profile.organizationId,
    userId: user.id,
    action,
    resourceType: "user",
    resourceId: result.user.id,
    before: result.before,
    after: { role: result.user.role, status: result.user.status },
  });
  revalidateUserManagement();
  return { success };
}
