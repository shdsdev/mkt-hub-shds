import "server-only";
import { createAdminClient } from "./admin-client";

export { createAdminClient } from "./admin-client";

export type InvitationGateway = {
  inviteNewUser(input: {
    email: string;
    emailRedirectTo: string;
  }): Promise<{ ok: true; authUserId: string } | { ok: false; error: "duplicate" | "provider_failure" }>;
  deleteUser(authUserId: string): Promise<void>;
};

// Service-role client — bypasses RLS and can create/manage auth users. Server-only: never import
// this from a Client Component or expose SUPABASE_SERVICE_ROLE_KEY as NEXT_PUBLIC_.
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
    if (error) {
      console.error("Supabase Auth user deletion failed.", {
        authUserId,
        code: error.code,
        message: error.message,
      });
      throw new Error("Unable to delete the provisioned Auth user.");
    }
  },
};
