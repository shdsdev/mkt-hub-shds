import { describe, expect, it, vi } from "vitest";

const { getCurrentUser, isAdmin, redirect } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isAdmin: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser }));
vi.mock("@/modules/users", () => ({ isAdmin }));
vi.mock("next/navigation", () => ({ redirect }));

import EmailMarketingLayout from "./layout";

describe("EmailMarketingLayout", () => {
  it("redirects non-admin users away from Email Marketing", async () => {
    getCurrentUser.mockResolvedValue({ profile: { role: "RECEPTION" } });
    isAdmin.mockReturnValue(false);

    await EmailMarketingLayout({ children: "content" });

    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("renders Email Marketing for admins", async () => {
    getCurrentUser.mockResolvedValue({ profile: { role: "ADMIN" } });
    isAdmin.mockReturnValue(true);

    const result = await EmailMarketingLayout({ children: "content" });

    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual("content");
  });
});
