import { and, asc, count, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db/client";
import { authUsers } from "../../db/auth-schema-ref";
import { invitationGateway } from "../../lib/supabase/admin";
import { users } from "./db";
import { createProfile, type Profile, type UserStatus } from "./service";

// Distinct runtime name for `public.users`, because joining it to `auth.users` produces two SQL
// tables both named `users` and every unqualified reference becomes ambiguous.
const profileUsers = alias(users, "profile_users");

export type ManagedUser = Pick<Profile, "id" | "organizationId" | "role" | "status" | "createdAt"> & {
  email: string;
};

export type ManagedRole = "ADMIN" | "MARKETING_USER";

export type ManagementMutationResult =
  | { ok: true; user: ManagedUser; before: { role: ManagedRole; status: UserStatus } }
  | { ok: false; reason: "target_not_found" | "self_disable" | "last_active_admin" };

export type InviteManagedUserInput = {
  organizationId: string;
  email: string;
  role: ManagedRole;
  emailRedirectTo: string;
};

export type InviteManagedUserResult =
  | { ok: true; user: ManagedUser }
  | { ok: false; reason: "duplicate" | "provider_failure" | "profile_failure" };

const managedUserFields = {
  id: profileUsers.id,
  organizationId: profileUsers.organizationId,
  role: profileUsers.role,
  status: profileUsers.status,
  createdAt: profileUsers.createdAt,
  email: sql<string>`coalesce(${authUsers.email}, '')`,
};

export async function listManagedUsers(organizationId: string): Promise<ManagedUser[]> {
  return db
    .select(managedUserFields)
    .from(profileUsers)
    .innerJoin(authUsers, eq(profileUsers.id, authUsers.id))
    .where(eq(profileUsers.organizationId, organizationId))
    .orderBy(asc(authUsers.email));
}

export async function inviteManagedUser(
  input: InviteManagedUserInput,
): Promise<InviteManagedUserResult> {
  const existing = await listManagedUsers(input.organizationId);
  if (existing.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, reason: "duplicate" };
  }

  const invited = await invitationGateway.inviteNewUser({
    email: input.email,
    emailRedirectTo: input.emailRedirectTo,
  });
  if (!invited.ok) return { ok: false, reason: invited.error };

  try {
    const profile = await createProfile({
      id: invited.authUserId,
      organizationId: input.organizationId,
      role: input.role,
    });
    return { ok: true, user: { ...profile, email: input.email } };
  } catch {
    await invitationGateway
      .deleteUser(invited.authUserId)
      .catch(() => logCompensationFailure(invited.authUserId));
    return { ok: false, reason: "profile_failure" };
  }
}

function logCompensationFailure(authUserId: string): void {
  console.error("Failed to compensate for managed-user profile creation.", {
    authUserId,
  });
}

export async function changeManagedUserRole(input: {
  organizationId: string;
  actorId: string;
  targetUserId: string;
  role: ManagedRole;
}): Promise<ManagementMutationResult> {
  return mutateManagedUser(input, { role: input.role });
}

export async function setManagedUserStatus(input: {
  organizationId: string;
  actorId: string;
  targetUserId: string;
  status: "active" | "disabled";
}): Promise<ManagementMutationResult> {
  return mutateManagedUser(input, { status: input.status });
}

async function mutateManagedUser(
  input: {
    organizationId: string;
    actorId: string;
    targetUserId: string;
  },
  change: Partial<Pick<ManagedUser, "role" | "status">>,
): Promise<ManagementMutationResult> {
  return db.transaction(async (tx) => {
    // Serialize lifecycle changes so concurrent requests cannot remove the final active admin.
    await tx.execute(
      sql`select id from public.users where organization_id = ${input.organizationId} for update`,
    );

    const [target] = await tx
      .select(managedUserFields)
      .from(profileUsers)
      .innerJoin(authUsers, eq(profileUsers.id, authUsers.id))
      .where(and(eq(profileUsers.id, input.targetUserId), eq(profileUsers.organizationId, input.organizationId)))
      .limit(1);

    if (!target) return { ok: false, reason: "target_not_found" };
    if (change.status === "disabled" && input.actorId === input.targetUserId) {
      return { ok: false, reason: "self_disable" };
    }

    const removesActiveAdmin =
      target.role === "ADMIN" &&
      target.status === "active" &&
      (change.role !== undefined && change.role !== "ADMIN" || change.status === "disabled");

    if (removesActiveAdmin) {
      const [{ activeAdminCount }] = await tx
        .select({ activeAdminCount: count() })
        .from(users)
        .where(
          and(
            eq(users.organizationId, input.organizationId),
            eq(users.role, "ADMIN"),
            eq(users.status, "active"),
          ),
        );

      if (activeAdminCount === 1) return { ok: false, reason: "last_active_admin" };
    }

    const [updated] = await tx
      .update(users)
      .set(change)
      .where(and(eq(users.id, input.targetUserId), eq(users.organizationId, input.organizationId)))
      .returning({
        id: users.id,
        organizationId: users.organizationId,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      });

    return {
      ok: true,
      user: { ...updated, email: target.email },
      before: { role: target.role as ManagedRole, status: target.status },
    };
  });
}
