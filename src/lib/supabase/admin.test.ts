import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));
vi.mock("server-only", () => ({}));

import { invitationGateway } from "./admin";

describe("invitationGateway.deleteUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    mocks.createClient.mockReturnValue({ auth: { admin: { deleteUser: mocks.deleteUser } } });
  });

  it("logs the provider error code and message without exposing secrets", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.deleteUser.mockResolvedValue({
      error: {
        code: "23503",
        message: "violates foreign key constraint",
        details: "secret-token-must-not-be-logged",
      },
    });

    await expect(invitationGateway.deleteUser("user-1")).rejects.toThrow(
      "Unable to delete the provisioned Auth user.",
    );

    expect(errorSpy).toHaveBeenCalledWith("Supabase Auth user deletion failed.", {
      authUserId: "user-1",
      code: "23503",
      message: "violates foreign key constraint",
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("secret-token-must-not-be-logged");
    errorSpy.mockRestore();
  });
});
