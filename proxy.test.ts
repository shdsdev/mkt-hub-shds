import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

const mocks = vi.hoisted(() => ({ updateSession: vi.fn(), getProfile: vi.fn() }));
vi.mock("@/lib/supabase/middleware", () => ({ updateSession: mocks.updateSession }));
vi.mock("@/modules/users", () => ({ getProfile: mocks.getProfile }));

import { config, proxy } from "./proxy";

const modules = ["admin", "analytics", "audit", "campaigns", "links", "notifications", "qr", "settings"];
const blockedPaths = ["/", ...modules.flatMap((name) => [`/${name}`, `/${name}/`, `/${name}/id/edit`])];
const origin = "https://app.example.com";
let sessionResponse: NextResponse;

afterEach(() => vi.useRealTimers());

beforeEach(() => {
  vi.resetAllMocks();
  sessionResponse = NextResponse.next();
  mocks.updateSession.mockResolvedValue({ response: sessionResponse, user: { id: "user-1" } });
  mocks.getProfile.mockResolvedValue({ id: "user-1", role: "RECEPTION" });
});

describe("RECEPTION route policy", () => {
  it.each(blockedPaths)("redirects GET %s to events without the original query", async (path) => {
    const response = await proxy(new NextRequest(`${origin}${path}?secret=value`));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${origin}/events`);
    expect(response.headers.has("x-middleware-next")).toBe(false);
    expect(mocks.getProfile).toHaveBeenCalledWith("user-1");
  });

  it("redirects HEAD requests", async () => {
    const response = await proxy(new NextRequest(`${origin}/links`, { method: "HEAD" }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`${origin}/events`);
  });

  it.each(blockedPaths)("rejects server action POST %s instead of forwarding or redirecting", async (path) => {
    const response = await proxy(new NextRequest(`${origin}${path}`, {
      method: "POST", headers: { "next-action": "mutation-id" }, body: "[]",
    }));
    expect(response.status).toBe(403);
    expect(response.headers.has("location")).toBe(false);
    expect(response.headers.has("x-middleware-next")).toBe(false);
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  });

  it.each(["PUT", "PATCH", "DELETE", "OPTIONS"])("rejects %s on prohibited modules", async (method) => {
    const response = await proxy(new NextRequest(`${origin}/settings`, { method }));
    expect(response.status).toBe(403);
  });

  it.each(["GET", "POST"])("preserves refreshed cookies and their attributes on blocked %s", async (method) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    sessionResponse.cookies.set("sb-session.0", "refreshed", {
      httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 3600,
    });
    sessionResponse.cookies.set("sb-session.1", "second-chunk", { path: "/", secure: true });
    sessionResponse.cookies.set("old-session", "", { path: "/", expires: new Date(0) });
    const response = await proxy(new NextRequest(`${origin}/`, { method }));
    expect(response.status).toBe(method === "GET" ? 307 : 403);
    expect(response.cookies.getAll()).toEqual(sessionResponse.cookies.getAll());
  });

  it.each(["/events", "/events/id/check-in", "/events/id/export", "/auth/callback", "/login",
    "/password-setup", "/api/events/id/raffle/token", "/api/analytics/consent", "/api/health",
    "/q/slug", "/r/slug", "/administrator", "/links-public"])("leaves %s unchanged", async (path) => {
    for (const method of ["GET", "POST"]) {
      expect(await proxy(new NextRequest(`${origin}${path}`, { method }))).toBe(sessionResponse);
    }
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "MARKETING_MANAGER", "MARKETING_USER", "VIEWER", "EVENT_EDITOR"])(
    "leaves %s users unchanged on every prohibited path", async (role) => {
      mocks.getProfile.mockResolvedValue({ role });
      for (const path of blockedPaths) {
        for (const method of ["GET", "POST"]) {
          expect(await proxy(new NextRequest(`${origin}${path}`, { method }))).toBe(sessionResponse);
        }
      }
    },
  );

  it("leaves unauthenticated requests unchanged without querying a profile", async () => {
    mocks.updateSession.mockResolvedValue({ response: sessionResponse, user: null });
    expect(await proxy(new NextRequest(`${origin}/`))).toBe(sessionResponse);
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("leaves missing profiles to the existing route authentication guards", async () => {
    mocks.getProfile.mockResolvedValue(undefined);
    expect(await proxy(new NextRequest(`${origin}/admin`))).toBe(sessionResponse);
  });

  it("ignores spoofed ADMIN auth metadata when the database role is RECEPTION", async () => {
    mocks.updateSession.mockResolvedValue({ response: sessionResponse, user: {
      id: "user-1", user_metadata: { role: "ADMIN" }, app_metadata: { role: "ADMIN" },
    } });
    expect((await proxy(new NextRequest(`${origin}/admin`))).status).toBe(307);
    expect(mocks.getProfile).toHaveBeenCalledWith("user-1");
  });

  it("does not use RECEPTION auth metadata to restrict a database ADMIN", async () => {
    mocks.updateSession.mockResolvedValue({ response: sessionResponse, user: {
      id: "user-1", user_metadata: { role: "RECEPTION" }, app_metadata: { role: "RECEPTION" },
    } });
    mocks.getProfile.mockResolvedValue({ role: "ADMIN" });
    expect(await proxy(new NextRequest(`${origin}/admin`))).toBe(sessionResponse);
    expect(mocks.getProfile).toHaveBeenCalledWith("user-1");
  });

  it("does not forward prohibited requests when the profile lookup fails", async () => {
    mocks.getProfile.mockRejectedValue(new Error("Database unavailable"));
    await expect(proxy(new NextRequest(`${origin}/links`, { method: "POST" }))).rejects.toThrow("Database unavailable");
  });
});

describe("proxy matcher", () => {
  it.each([...blockedPaths, "/qr/id/download?format=svg", ...modules.map((name) => `/${name}/export.svg`)])(
    "covers protected request %s, including image-like downloads", async (path) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `${origin}${path}` })).toBe(true);
      expect((await proxy(new NextRequest(`${origin}${path}`))).status).toBe(307);
    },
  );

  it.each(["/_next/static/chunk.js", "/_next/image?url=test", "/favicon.ico", "/logo.svg", "/photo.png", "/q/slug", "/r/slug"])(
    "keeps the existing asset and redirect exclusion for %s", (path) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `${origin}${path}` })).toBe(false);
    },
  );
});
