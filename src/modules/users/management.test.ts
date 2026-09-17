import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, select, update, execute, createProfile, inviteNewUser, deleteUser } = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
  createProfile: vi.fn(),
  inviteNewUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  db: { transaction, select },
}));

vi.mock("../../db/auth-schema-ref", () => ({
  authUsers: { id: "auth_id", email: "auth_email" },
}));

vi.mock("./db", () => ({
  users: {
    id: "id",
    organizationId: "organization_id",
    role: "role",
    status: "status",
    createdAt: "created_at",
  },
}));

vi.mock("./service", () => ({
  createProfile,
}));

vi.mock("../../lib/supabase/admin", () => ({
  invitationGateway: { inviteNewUser, deleteUser },
}));

import {
  changeManagedUserRole,
  inviteManagedUser,
  setManagedUserStatus,
} from "./management";

function query<T>(rows: T[]) {
  const result = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    returning: vi.fn(),
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve),
  };

  result.from.mockReturnValue(result);
  result.innerJoin.mockReturnValue(result);
  result.where.mockReturnValue(result);
  result.orderBy.mockReturnValue(result);
  result.limit.mockReturnValue(result);
  result.returning.mockReturnValue(result);
  return result;
}

describe("managed user lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ execute, select, update }),
    );
  });

  it("returns target_not_found when the target is outside the actor organization", async () => {
    select.mockReturnValueOnce(query([]));

    await expect(
      setManagedUserStatus({
        organizationId: "org-1",
        actorId: "actor-1",
        targetUserId: "org-2-user",
        status: "disabled",
      }),
    ).resolves.toEqual({ ok: false, reason: "target_not_found" });

    expect(update).not.toHaveBeenCalled();
  });

  it("rejects disabling the final active ADMIN while holding the organization user rows", async () => {
    select
      .mockReturnValueOnce(
        query([
          {
            id: "admin-1",
            organizationId: "org-1",
            role: "ADMIN",
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            email: "admin@example.com",
          },
        ]),
      )
      .mockReturnValueOnce(query([{ activeAdminCount: 1 }]));

    await expect(
      setManagedUserStatus({
        organizationId: "org-1",
        actorId: "actor-2",
        targetUserId: "admin-1",
        status: "disabled",
      }),
    ).resolves.toEqual({ ok: false, reason: "last_active_admin" });

    expect(execute).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects demoting the final active ADMIN while holding the organization user rows", async () => {
    select
      .mockReturnValueOnce(
        query([
          {
            id: "admin-1",
            organizationId: "org-1",
            role: "ADMIN",
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            email: "admin@example.com",
          },
        ]),
      )
      .mockReturnValueOnce(query([{ activeAdminCount: 1 }]));

    await expect(
      changeManagedUserRole({
        organizationId: "org-1",
        actorId: "actor-2",
        targetUserId: "admin-1",
        role: "MARKETING_USER",
      }),
    ).resolves.toEqual({ ok: false, reason: "last_active_admin" });

    expect(execute).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects disabling the acting user before a write", async () => {
    select.mockReturnValueOnce(
      query([
        {
          id: "actor-1",
          organizationId: "org-1",
          role: "ADMIN",
          status: "active",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          email: "admin@example.com",
        },
      ]),
    );

    await expect(
      setManagedUserStatus({
        organizationId: "org-1",
        actorId: "actor-1",
        targetUserId: "actor-1",
        status: "disabled",
      }),
    ).resolves.toEqual({ ok: false, reason: "self_disable" });

    expect(update).not.toHaveBeenCalled();
  });
});

describe("managed user invitation", () => {
  const validInput = {
    organizationId: "org-1",
    email: "new@example.com",
    role: "MARKETING_USER" as const,
    emailRedirectTo: "https://app.example.com/auth/callback",
  };
  const profile = {
    id: "new-auth-user-id",
    organizationId: "org-1",
    role: "MARKETING_USER" as const,
    status: "active" as const,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    select.mockReturnValue(query([]));
    inviteNewUser.mockResolvedValue({ ok: true, authUserId: profile.id });
    deleteUser.mockResolvedValue(undefined);
    createProfile.mockResolvedValue(profile);
  });

  it("creates the profile only after Auth provisioning returns an ID", async () => {
    const callLog: string[] = [];
    inviteNewUser.mockImplementation(async () => {
      callLog.push("invite-auth");
      return { ok: true, authUserId: profile.id };
    });
    createProfile.mockImplementation(async () => {
      callLog.push("create-profile");
      return profile;
    });

    await expect(inviteManagedUser(validInput)).resolves.toEqual({
      ok: true,
      user: { ...profile, email: validInput.email },
    });

    expect(callLog).toEqual(["invite-auth", "create-profile"]);
  });

  it("does not create a profile when Auth provisioning fails", async () => {
    inviteNewUser.mockResolvedValue({ ok: false, error: "provider_failure" });

    await expect(inviteManagedUser(validInput)).resolves.toEqual({
      ok: false,
      reason: "provider_failure",
    });

    expect(createProfile).not.toHaveBeenCalled();
  });

  it("deletes the newly created Auth identity when profile creation fails", async () => {
    createProfile.mockRejectedValue(new Error("database unavailable"));

    await expect(inviteManagedUser(validInput)).resolves.toEqual({
      ok: false,
      reason: "profile_failure",
    });

    expect(deleteUser).toHaveBeenCalledWith("new-auth-user-id");
  });

  it("logs only operation context and the Auth UUID when compensation fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    createProfile.mockRejectedValue(new Error("database unavailable"));
    deleteUser.mockRejectedValue(
      new Error("https://invite.example.com/?token=secret-provider-response"),
    );

    await inviteManagedUser(validInput);

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to compensate for managed-user profile creation.",
      { authUserId: "new-auth-user-id" },
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("secret-provider-response");
    errorSpy.mockRestore();
  });
});
