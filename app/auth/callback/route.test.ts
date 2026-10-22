import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
      signOut: mocks.signOut,
    },
  }),
}));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));

import { GET } from "./route";

describe("auth callback", () => {
  it("exchanges a valid invitation code and redirects to password setup", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await GET(new Request("https://app.example.com/auth/callback?code=code-1"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("code-1");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.example.com/password-setup");
  });

  it("uses a safe relative next destination after exchanging the code", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await GET(
      new Request("https://app.example.com/auth/callback?code=code-1&next=/password-setup?mode=recovery"),
    );

    expect(res.headers.get("location")).toBe("https://app.example.com/password-setup?mode=recovery");
  });

  it("ignores an absolute next destination", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await GET(
      new Request("https://app.example.com/auth/callback?code=code-1&next=https://evil.example"),
    );

    expect(res.headers.get("location")).toBe("https://app.example.com/password-setup");
  });

  it("allows Google OAuth only when the active Marketing Hub profile exists", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getCurrentUser.mockResolvedValue({ profile: { status: "active" } });
    mocks.isActive.mockReturnValue(true);

    const res = await GET(new Request("https://app.example.com/auth/callback?provider=google&code=code-1&next=/"));

    expect(res.headers.get("location")).toBe("https://app.example.com/");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects Google OAuth when no Marketing Hub profile exists", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getCurrentUser.mockResolvedValue(undefined);

    const res = await GET(new Request("https://app.example.com/auth/callback?provider=google&code=code-1&next=/"));

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://app.example.com/login?error=google_access");
  });

  it("rejects Google OAuth when the Marketing Hub profile is inactive", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getCurrentUser.mockResolvedValue({ profile: { status: "disabled" } });
    mocks.isActive.mockReturnValue(false);

    const res = await GET(new Request("https://app.example.com/auth/callback?provider=google&code=code-1&next=/"));

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://app.example.com/login?error=google_access");
  });

  it("verifies a token hash when the provider uses the invite or recovery format", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      new Request(
        "https://app.example.com/auth/callback?token_hash=token-1&type=recovery&next=/password-setup",
      ),
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "token-1" });
    expect(res.headers.get("location")).toBe("https://app.example.com/password-setup");
  });

  it("ignores a next destination that disguises a protocol-relative redirect with a backslash", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const res = await GET(
      new Request("https://app.example.com/auth/callback?code=code-1&next=/%5Cevil.example"),
    );

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
