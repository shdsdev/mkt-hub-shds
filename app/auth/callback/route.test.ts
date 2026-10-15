import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
    },
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
