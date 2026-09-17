import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  checkRateLimit: vi.fn(),
  recordAudit: vi.fn(),
  inviteManagedUser: vi.fn(),
  changeManagedUserRole: vi.fn(),
  setManagedUserStatus: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({
  isActive: mocks.isActive,
  isAdmin: mocks.isAdmin,
  inviteManagedUser: mocks.inviteManagedUser,
  changeManagedUserRole: mocks.changeManagedUserRole,
  setManagedUserStatus: mocks.setManagedUserStatus,
}));
vi.mock("@/modules/audit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordAudit: mocks.recordAudit,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  changeUserRoleAction,
  disableUserAction,
  inviteUserAction,
  reactivateUserAction,
} from "./actions";

const actor = {
  id: "actor-1",
  email: "admin@example.com",
  profile: {
    id: "actor-1",
    organizationId: "org-1",
    role: "ADMIN",
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
};
const targetUserId = "7a29aa2a-4e37-4b15-97a0-1aa6fef2f36d";
const target = {
  id: targetUserId,
  organizationId: "org-1",
  role: "MARKETING_USER",
  status: "active",
  email: "target@example.com",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function inviteFormData(input: { email?: string; role?: string } = {}) {
  const formData = new FormData();
  formData.set("email", input.email ?? "target@example.com");
  formData.set("role", input.role ?? "User");
  return formData;
}

function roleFormData(role = "User") {
  const formData = new FormData();
  formData.set("targetUserId", targetUserId);
  formData.set("role", role);
  return formData;
}

function targetFormData() {
  const formData = new FormData();
  formData.set("targetUserId", targetUserId);
  return formData;
}

describe("user-management server actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(actor);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.inviteManagedUser.mockResolvedValue({ ok: true, user: target });
    mocks.changeManagedUserRole.mockResolvedValue({
      ok: true,
      user: target,
      before: { role: "ADMIN", status: "active" },
    });
    mocks.setManagedUserStatus.mockResolvedValue({
      ok: true,
      user: target,
      before: { role: "MARKETING_USER", status: "disabled" },
    });
  });

  it("does not call services, audit, or revalidation for a disabled ADMIN", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      ...actor,
      profile: { ...actor.profile, status: "disabled" },
    });
    mocks.isActive.mockReturnValue(false);

    await expect(inviteUserAction({}, inviteFormData())).resolves.toEqual({
      error: "No tienes permiso para administrar usuarios.",
    });

    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.inviteManagedUser).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not call services, audit, or revalidation for a rate-limited ADMIN", async () => {
    mocks.checkRateLimit.mockReturnValue(false);

    await expect(inviteUserAction({}, inviteFormData())).resolves.toEqual({
      error: "Demasiadas acciones. Inténtalo de nuevo en breve.",
    });

    expect(mocks.inviteManagedUser).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not mutate, audit, or revalidate malformed forms", async () => {
    await expect(changeUserRoleAction({}, roleFormData("VIEWER"))).resolves.toEqual({
      error: "Los datos del usuario no son válidos.",
    });

    expect(mocks.changeManagedUserRole).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps User to MARKETING_USER and audits only a successful invite", async () => {
    await expect(inviteUserAction({}, inviteFormData({ role: "User" }))).resolves.toEqual({
      success: "Invitación enviada.",
    });

    expect(mocks.inviteManagedUser).toHaveBeenCalledWith({
      organizationId: "org-1",
      email: "target@example.com",
      role: "MARKETING_USER",
      emailRedirectTo: "http://localhost:3000/auth/callback",
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "actor-1",
      action: "invite_user",
      resourceType: "user",
      resourceId: targetUserId,
      after: { role: "MARKETING_USER", status: "active" },
    });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/settings/users");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/settings");
  });

  it("revalidates both Settings paths only after a successful role update", async () => {
    await expect(changeUserRoleAction({}, roleFormData("ADMIN"))).resolves.toEqual({
      success: "Rol actualizado.",
    });

    expect(mocks.changeManagedUserRole).toHaveBeenCalledWith({
      organizationId: "org-1",
      actorId: "actor-1",
      targetUserId,
      role: "ADMIN",
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "actor-1",
      action: "change_user_role",
      resourceType: "user",
      resourceId: targetUserId,
      before: { role: "ADMIN", status: "active" },
      after: { role: "MARKETING_USER", status: "active" },
    });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/settings/users");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/settings");
  });

  it("does not audit or revalidate an unavailable target", async () => {
    mocks.setManagedUserStatus.mockResolvedValue({ ok: false, reason: "target_not_found" });

    await expect(disableUserAction({}, targetFormData())).resolves.toEqual({
      error: "El usuario no está disponible.",
    });

    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns actionable constraint failures before audit or revalidation", async () => {
    mocks.setManagedUserStatus.mockResolvedValue({ ok: false, reason: "self_disable" });

    await expect(disableUserAction({}, targetFormData())).resolves.toEqual({
      error: "No puedes desactivar tu propia cuenta.",
    });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    mocks.changeManagedUserRole.mockResolvedValue({ ok: false, reason: "last_active_admin" });

    await expect(changeUserRoleAction({}, roleFormData())).resolves.toEqual({
      error: "Debe permanecer al menos un administrador activo.",
    });
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("audits and revalidates a successful reactivation", async () => {
    await expect(reactivateUserAction({}, targetFormData())).resolves.toEqual({
      success: "Usuario reactivado.",
    });

    expect(mocks.setManagedUserStatus).toHaveBeenCalledWith({
      organizationId: "org-1",
      actorId: "actor-1",
      targetUserId,
      status: "active",
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "actor-1",
      action: "reactivate_user",
      resourceType: "user",
      resourceId: targetUserId,
      before: { role: "MARKETING_USER", status: "disabled" },
      after: { role: "MARKETING_USER", status: "active" },
    });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/settings/users");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/settings");
  });
});
