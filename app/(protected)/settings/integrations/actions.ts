"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import {
  createPairingCode,
  renewHcsConnection,
  revokeHcsConnection,
} from "@/modules/integrations";
import { isActive, isAdmin } from "@/modules/users";
import { env } from "@/lib/env";

const connectionSchema = z.object({ connectionId: z.string().uuid() });
const PERMISSION_ERROR = "No tienes permiso para administrar integraciones.";
const INVALID_FORM_ERROR = "La conexión seleccionada no es válida.";

export type HcsIntegrationActionState = {
  error?: string;
  success?: string;
  pairingCode?: string;
  expiresAt?: string;
  accessToken?: string;
  connectionId?: string;
  companyName?: string;
};

async function requireActiveAdmin() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) return undefined;
  return user;
}

export async function generateHcsPairingCodeAction(
  _state: HcsIntegrationActionState,
): Promise<HcsIntegrationActionState> {
  void _state;
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const expiresAt = new Date(Date.now() + env.HCS_PAIRING_EXPIRY_MINUTES * 60_000);
  const result = await createPairingCode({ organizationId: user.profile.organizationId, expiresAt });
  return { pairingCode: result.code, expiresAt: expiresAt.toISOString() };
}

export async function revokeHcsConnectionAction(
  _state: HcsIntegrationActionState,
  formData: FormData,
): Promise<HcsIntegrationActionState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = connectionSchema.safeParse({ connectionId: formData.get("connectionId") });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const connection = await revokeHcsConnection({
    organizationId: user.profile.organizationId,
    connectionId: parsed.data.connectionId,
  });
  if (!connection) return { error: "La conexión no está disponible." };

  revalidatePath("/settings/integrations");
  return { success: "Conexión revocada." };
}

export async function renewHcsConnectionAction(
  _state: HcsIntegrationActionState,
  formData: FormData,
): Promise<HcsIntegrationActionState> {
  const user = await requireActiveAdmin();
  if (!user) return { error: PERMISSION_ERROR };

  const parsed = connectionSchema.safeParse({ connectionId: formData.get("connectionId") });
  if (!parsed.success) return { error: INVALID_FORM_ERROR };

  const expiresAt = new Date(Date.now() + env.HCS_CONNECTION_EXPIRY_DAYS * 86_400_000);
  try {
    const result = await renewHcsConnection({
      organizationId: user.profile.organizationId,
      connectionId: parsed.data.connectionId,
      expiresAt,
    });
    revalidatePath("/settings/integrations");
    return {
      success: "Token renovado. Guardalo ahora: no volverá a mostrarse.",
      accessToken: result.accessToken,
      connectionId: result.connection.id,
      companyName: result.connection.hcsCompanyName,
      expiresAt: expiresAt.toISOString(),
    };
  } catch {
    return { error: "La conexión no está disponible para renovar." };
  }
}
