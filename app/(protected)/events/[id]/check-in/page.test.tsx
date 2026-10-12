import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  getEvent: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive }));
vi.mock("@/modules/events", () => ({ getEvent: mocks.getEvent }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./check-in-form", () => ({
  CheckInForm: ({ eventId }: { eventId: string }) => <div data-event-id={eventId} />,
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

  it("renders the event name and the check-in form for a non-admin active user", async () => {
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });

    const result = await EventCheckInPage({ params: makeParams("event-1") });

    expect(mocks.getEvent).toHaveBeenCalledWith("event-1", "org-1");
    expect(JSON.stringify(result)).toContain("Workshop de Marketing");
  });
});
