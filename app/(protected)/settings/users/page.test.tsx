import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  listManagedUsers: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({
  isActive: mocks.isActive,
  isAdmin: mocks.isAdmin,
  listManagedUsers: mocks.listManagedUsers,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./user-management", () => ({
  UserManagement: ({ users }: { users: unknown[] }) => <div data-users={users.length} />,
}));

import UsersSettingsPage from "./page";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  profile: {
    id: "admin-1",
    organizationId: "org-1",
    role: "ADMIN",
    status: "active",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
};

const marketingUser = {
  ...adminUser,
  profile: { ...adminUser.profile, role: "MARKETING_USER" },
};

describe("UsersSettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.listManagedUsers.mockResolvedValue([]);
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("returns notFound for an active non-ADMIN", async () => {
    mocks.getCurrentUser.mockResolvedValue(marketingUser);
    mocks.isAdmin.mockReturnValue(false);

    await expect(UsersSettingsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.listManagedUsers).not.toHaveBeenCalled();
  });

  it("lists only the current ADMIN organization users", async () => {
    await UsersSettingsPage();

    expect(mocks.listManagedUsers).toHaveBeenCalledWith("org-1");
  });
});
