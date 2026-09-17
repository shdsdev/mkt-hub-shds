import "server-only";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

export type InvitationGateway = {
  inviteNewUser(input: {
    email: string;
    emailRedirectTo: string;
  }): Promise<{ ok: true; authUserId: string } | { ok: false; error: "duplicate" | "provider_failure" }>;
  deleteUser(authUserId: string): Promise<void>;
};

// Service-role client — bypasses RLS and can create/manage auth users. Server-only: never import
// this from a Client Component or expose SUPABASE_SERVICE_ROLE_KEY as NEXT_PUBLIC_.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for the admin client.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isExistingIdentityError(error: { code?: string } | null): boolean {
  return error?.code === "email_exists" || error?.code === "user_already_exists";
}

export const invitationGateway: InvitationGateway = {
  async inviteNewUser({ email, emailRedirectTo }) {
    const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
      redirectTo: emailRedirectTo,
    });

    if (error) {
      return { ok: false, error: isExistingIdentityError(error) ? "duplicate" : "provider_failure" };
    }

    if (!data.user?.id) return { ok: false, error: "provider_failure" };
    return { ok: true, authUserId: data.user.id };
  },

  async deleteUser(authUserId) {
    const { error } = await createAdminClient().auth.admin.deleteUser(authUserId);
    if (error) throw new Error("Unable to delete the provisioned Auth user.");
  },
};
