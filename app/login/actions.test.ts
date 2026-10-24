import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/modules/auth", () => mocks);
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

import { login } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signIn.mockResolvedValue({ success: true });
});

function credentials() {
  const form = new FormData();
  form.set("email", "reception@example.com");
  form.set("password", "test-password");
  return form;
}

describe("login destination", () => {
  it("sends reception directly to events", async () => {
    mocks.getCurrentUser.mockResolvedValue({ profile: { role: "RECEPTION" } });
    await expect(login({}, credentials())).rejects.toThrow("redirect:/events");
  });

  it.each(["ADMIN", "MARKETING", "EVENT_EDITOR"])("preserves the destination for %s", async (role) => {
    mocks.getCurrentUser.mockResolvedValue({ profile: { role } });
    await expect(login({}, credentials())).rejects.toThrow("redirect:/");
  });

  it("does not look up a destination after failed authentication", async () => {
    mocks.signIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    expect(await login({}, credentials())).toEqual({ error: "Invalid credentials" });
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });
});
