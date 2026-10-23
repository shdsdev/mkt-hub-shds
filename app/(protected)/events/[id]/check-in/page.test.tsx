import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  canAccessEvent: vi.fn(),
  getEvent: vi.fn(),
  listEventBenefitRedemptions: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({ getEvent: mocks.getEvent, canAccessEvent: mocks.canAccessEvent, listEventBenefitRedemptions: mocks.listEventBenefitRedemptions }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./check-in-form", () => ({
  CheckInForm: ({ eventId }: { eventId: string }) => <div data-event-id={eventId} />,
}));
vi.mock("./benefit-redemption-form", () => ({
  BenefitRedemptionForm: ({ eventId }: { eventId: string }) => <div data-benefit-event-id={eventId} />,
}));
vi.mock("./qr-scanner", () => ({
  ScannerCoordinatorProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("../../event-sub-nav", () => ({
  EventSubNav: ({ eventId, current }: { eventId: string; current: string }) => <div data-sub-nav-event-id={eventId} data-current={current} />,
}));

import EventCheckInPage from "./page";

const activeUser = {
  id: "staff-1",
  email: "staff@example.com",
  profile: { id: "staff-1", organizationId: "org-1", role: "MARKETING_USER", status: "active", createdAt: new Date() },
};

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("EventCheckInPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(activeUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(false);
    mocks.canAccessEvent.mockResolvedValue(true);
    mocks.listEventBenefitRedemptions.mockResolvedValue([]);
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("returns notFound when there is no active session (any role, but must be active)", async () => {
    mocks.isActive.mockReturnValue(false);

    await expect(EventCheckInPage({ params: makeParams("event-1") })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getEvent).not.toHaveBeenCalled();
  });

  it("returns notFound when the event does not exist in the user's organization", async () => {
    mocks.getEvent.mockResolvedValue(undefined);

    await expect(EventCheckInPage({ params: makeParams("event-1") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the event name and the check-in form for an assigned Reception user", async () => {
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });

    const result = await EventCheckInPage({ params: makeParams("event-1") });

    expect(mocks.getEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(JSON.stringify(result)).toContain("Workshop de Marketing");
    expect(JSON.stringify(result)).toContain("max-w-[1440px]");
    expect(JSON.stringify(result)).toContain("grid gap-6 lg:grid-cols-2");
    expect(JSON.stringify(result).match(/"eventId":"event-1"/g)).toHaveLength(3);
    expect(mocks.canAccessEvent).toHaveBeenCalledWith(expect.objectContaining({ capability: "check-in" }));
    expect(JSON.stringify(result)).toContain('"current":"check-in"');
  });

  it("renders the cross-event sub-nav for an ADMIN", async () => {
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });

    const result = await EventCheckInPage({ params: makeParams("event-1") });

    expect(JSON.stringify(result)).toContain('"current":"check-in"');
  });
});
