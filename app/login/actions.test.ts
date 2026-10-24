import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), getCurrentUser: vi.fn(), select: vi.fn(), where: vi.fn(), orderBy: vi.fn() }));
vi.mock("@/modules/auth", () => mocks);
vi.mock("@/db/client", () => ({ db: { select: mocks.select } }));
vi.mock("@/lib/supabase/admin", () => ({ invitationGateway: {} }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));

import { login } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signIn.mockResolvedValue({ success: true });
  mocks.select.mockReturnValue({ from: () => ({ innerJoin: () => ({ where: mocks.where }) }) });
  mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
  mocks.orderBy.mockResolvedValue([]);
});

function credentials() {
  const form = new FormData();
  form.set("email", "reception@example.com");
  form.set("password", "test-password");
  return form;
}

describe("login destination", () => {
  it.each([
    { ids: [], destination: "/events" },
    { ids: ["event-1"], destination: "/events/event-1/dashboard" },
    { ids: ["event-1", "event-2"], destination: "/events" },
  ])("sends reception with $ids to $destination", async ({ ids, destination }) => {
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1", profile: { role: "RECEPTION", organizationId: "org-1" } });
    mocks.orderBy.mockResolvedValue(ids.map((id) => ({ event: { id } })));

    await expect(login({}, credentials())).rejects.toThrow(`redirect:${destination}`);

    expect(mocks.where).toHaveBeenCalledOnce();
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.sql).toContain('"events"."organization_id" =');
    expect(query.sql).toContain('"event_receptionists"."user_id" =');
    expect(query.sql).toContain('"events"."status" <>');
    expect(query.params).toEqual(["org-1", "user-1", "archived"]);
  });

  it.each(["ADMIN", "MARKETING", "EVENT_EDITOR"])("preserves the destination for %s", async (role) => {
    mocks.getCurrentUser.mockResolvedValue({ profile: { role } });
    await expect(login({}, credentials())).rejects.toThrow("redirect:/");
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("does not look up a destination after failed authentication", async () => {
    mocks.signIn.mockResolvedValue({ success: false, error: "Invalid credentials" });
    expect(await login({}, credentials())).toEqual({ error: "Invalid credentials" });
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("preserves the fallback when no current profile is available", async () => {
    mocks.getCurrentUser.mockResolvedValue(undefined);
    await expect(login({}, credentials())).rejects.toThrow("redirect:/");
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
