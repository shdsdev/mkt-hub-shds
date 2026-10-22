import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  canAccessEvent: vi.fn(),
  getEventInsights: vi.fn(),
  getEvent: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({ getEventInsights: mocks.getEventInsights, getEvent: mocks.getEvent, canAccessEvent: mocks.canAccessEvent }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import EventDashboardPage from "./page";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  profile: { id: "admin-1", organizationId: "org-1", role: "ADMIN", status: "active", createdAt: new Date() },
};

function params(id: string) {
  return Promise.resolve({ id });
}

describe("EventDashboardPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("returns notFound for a non-ADMIN user", async () => {
    mocks.isAdmin.mockReturnValue(false);
    mocks.canAccessEvent.mockResolvedValue(false);

    await expect(EventDashboardPage({ params: params("event-1") })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getEventInsights).not.toHaveBeenCalled();
  });

  it("returns notFound when the event is outside the organization", async () => {
    mocks.getEventInsights.mockResolvedValue(undefined);

    await expect(EventDashboardPage({ params: params("event-1") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders visits, registrations, attendance, and a formatted conversion rate", async () => {
    mocks.getEventInsights.mockResolvedValue({ visits: 100, registrations: 40, attendance: 10, conversion: 0.4 });

    const result = await EventDashboardPage({ params: params("event-1") });

    const json = JSON.stringify(result);
    expect(json).toContain("Workshop de Marketing");
    expect(json).toContain("100");
    expect(json).toContain("40");
    expect(json).toContain("10");
    expect(json).toContain("40%");
  });

  it("renders a dash (not 0%) for conversion when there have been no visits", async () => {
    mocks.getEventInsights.mockResolvedValue({ visits: 0, registrations: 0, attendance: 0, conversion: null });

    const result = await EventDashboardPage({ params: params("event-1") });

    expect(JSON.stringify(result)).not.toContain("0%");
  });
});
