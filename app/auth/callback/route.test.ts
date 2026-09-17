import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
}));

import { GET } from "./route";

describe("auth callback", () => {
  it("exchanges a valid invitation code and redirects to password setup", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await GET(new Request("https://app.example.com/auth/callback?code=code-1"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("code-1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.example.com/password-setup");
  });

  it("redirects to login with error when the code is missing", async () => {
    const res = await GET(new Request("https://app.example.com/auth/callback"));

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.example.com/login?error=invitation");
  });

  it("redirects to login with error when the code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid token" } });

    const res = await GET(new Request("https://app.example.com/auth/callback?code=code-1"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.example.com/login?error=invitation");
  });
});