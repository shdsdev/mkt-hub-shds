import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      verifyOtp: mocks.verifyOtp,
      signOut: mocks.signOut,
    },
  }),
}));
vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("@/lib/supabase/admin", () => ({ invitationGateway: {} }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.select.mockReturnValue({ from: () => ({ innerJoin: () => ({ where: mocks.where }) }) });
  mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
  mocks.orderBy.mockResolvedValue([]);
});

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
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "MARKETING", "EVENT_EDITOR"])("preserves the safe Google destination for %s", async (role) => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getCurrentUser.mockResolvedValue({ profile: { status: "active", role } });

    const res = await GET(new Request("https://app.example.com/auth/callback?provider=google&code=code-1&next=/settings?tab=profile"));

    expect(res.headers.get("location")).toBe("https://app.example.com/settings?tab=profile");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("preserves the open-redirect guard for Google sign-ins", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getCurrentUser.mockResolvedValue({ profile: { status: "active", role: "ADMIN" } });

    const res = await GET(new Request("https://app.example.com/auth/callback?provider=google&code=code-1&next=/%5Cevil.example"));

    expect(res.headers.get("location")).toBe("https://app.example.com/password-setup");
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it.each([
    { ids: [], destination: "/events" },
    { ids: ["event-1"], destination: "/events/event-1/dashboard" },
    { ids: ["event-1", "event-2"], destination: "/events" },
  ])("sends reception Google sign-ins with $ids to $destination", async ({ ids, destination }) => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", profile: { status: "active", role: "RECEPTION", organizationId: "org-1" } });
    mocks.orderBy.mockResolvedValue(ids.map((id) => ({ event: { id } })));

    const res = await GET(new Request("https://app.example.com/auth/callback?provider=google&code=code-1&next=/settings"));

    expect(res.headers.get("location")).toBe(`https://app.example.com${destination}`);
    expect(mocks.where).toHaveBeenCalledOnce();
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain('"events"."organization_id" =');
    expect(query.sql).toContain('"event_receptionists"."user_id" =');
    expect(query.sql).toContain('"events"."status" <>');
    expect(query.params).toEqual(["org-1", "user-1", "archived"]);
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

    const res = await GET(new Request("https://app.example.com/auth/callback?provider=google&code=code-1&next=/"));

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://app.example.com/login?error=google_access");
  });

  it.each(["invite", "recovery"])("preserves password setup for a %s token hash", async (type) => {
    mocks.verifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      new Request(
        `https://app.example.com/auth/callback?token_hash=token-1&type=${type}&next=/password-setup`,
      ),
    );

    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type, token_hash: "token-1" });
    expect(res.headers.get("location")).toBe("https://app.example.com/password-setup");
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
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
