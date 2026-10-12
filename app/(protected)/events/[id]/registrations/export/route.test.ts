import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  getEvent: vi.fn(),
  listRegistrations: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({ getEvent: mocks.getEvent, listRegistrations: mocks.listRegistrations }));

import { GET } from "./route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  profile: { id: "admin-1", organizationId: "org-1", role: "ADMIN", status: "active", createdAt: new Date() },
};

function requestWith(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

function params(id: string) {
  return Promise.resolve({ id });
}

describe("GET /events/[id]/registrations/export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop" });
    mocks.listRegistrations.mockResolvedValue([]);
  });

  it("rejects an unauthenticated request with 401", async () => {
    mocks.getCurrentUser.mockResolvedValue(undefined);

    const response = await GET(requestWith("https://app.example.com/events/event-1/registrations/export"), {
      params: params("event-1"),
    });

    expect(response.status).toBe(401);
    expect(mocks.listRegistrations).not.toHaveBeenCalled();
  });

  it("rejects a non-ADMIN active user with 403", async () => {
    mocks.isAdmin.mockReturnValue(false);

    const response = await GET(requestWith("https://app.example.com/events/event-1/registrations/export"), {
      params: params("event-1"),
    });

    expect(response.status).toBe(403);
    expect(mocks.listRegistrations).not.toHaveBeenCalled();
  });

  it("returns 404 when the event is outside the ADMIN's organization", async () => {
    mocks.getEvent.mockResolvedValue(undefined);

    const response = await GET(requestWith("https://app.example.com/events/event-1/registrations/export"), {
      params: params("event-1"),
    });

    expect(response.status).toBe(404);
  });

  it("returns the CSV as a download, scoped to the event+organization", async () => {
    const response = await GET(requestWith("https://app.example.com/events/event-1/registrations/export"), {
      params: params("event-1"),
    });

    expect(mocks.listRegistrations).toHaveBeenCalledWith("event-1", "org-1", { status: undefined, q: undefined });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("attachment");
  });

  it("forwards the status filter from the query string", async () => {
    await GET(
      requestWith("https://app.example.com/events/event-1/registrations/export?status=waitlisted"),
      { params: params("event-1") },
    );

    expect(mocks.listRegistrations).toHaveBeenCalledWith("event-1", "org-1", {
      status: "waitlisted",
      q: undefined,
    });
  });
});
