import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  getEvent: vi.fn(),
  listRegistrations: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({ getEvent: mocks.getEvent, listRegistrations: mocks.listRegistrations }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./add-companion-row", () => ({
  AddCompanionRow: ({ registrationId }: { registrationId: string }) => (
    <div data-add-companion-registration-id={registrationId} />
  ),
}));
vi.mock("./registration-detail-sheet", () => ({
  RegistrationDetailSheet: () => <div data-registration-detail-sheet="" />,
}));
vi.mock("./registrations-table", () => ({
  RegistrationsTable: ({ registrations, eventId }: { registrations: unknown[]; eventId: string }) => (
    <div data-testid="registrations-table">{eventId}:{registrations.length}</div>
  ),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import RegistrationsPage from "./page";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  profile: { id: "admin-1", organizationId: "org-1", role: "ADMIN", status: "active", createdAt: new Date() },
};

function params(id: string) {
  return Promise.resolve({ id });
}

function searchParams(entries: Record<string, string | undefined> = {}) {
  return Promise.resolve(entries);
}

describe("RegistrationsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(adminUser);
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue({ id: "event-1", name: "Workshop de Marketing" });
    mocks.listRegistrations.mockResolvedValue([]);
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("returns notFound for a non-ADMIN user", async () => {
    mocks.isAdmin.mockReturnValue(false);

    await expect(
      RegistrationsPage({ params: params("event-1"), searchParams: searchParams() }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.listRegistrations).not.toHaveBeenCalled();
  });

  it("returns notFound when the event is outside the organization", async () => {
    mocks.getEvent.mockResolvedValue(undefined);

    await expect(
      RegistrationsPage({ params: params("event-1"), searchParams: searchParams() }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lists registrations scoped to the event+organization with no filter by default", async () => {
    await RegistrationsPage({ params: params("event-1"), searchParams: searchParams() });

    expect(mocks.listRegistrations).toHaveBeenCalledWith("event-1", "org-1", {
      status: undefined,
      q: undefined,
    });
  });

  it("forwards the status and q query params as filters", async () => {
    await RegistrationsPage({
      params: params("event-1"),
      searchParams: searchParams({ status: "waitlisted", q: "ada" }),
    });

    expect(mocks.listRegistrations).toHaveBeenCalledWith("event-1", "org-1", {
      status: "waitlisted",
      q: "ada",
    });
  });

  it("preserves status and search in filter and export links", async () => {
    const result = await RegistrationsPage({
      params: params("event-1"),
      searchParams: searchParams({ status: "confirmed", q: "ada" }),
    });
    const serialized = JSON.stringify(result);

    expect(serialized).toContain("/events/event-1/registrations?status=confirmed&q=ada");
    expect(serialized).toContain("/events/event-1/registrations/export?status=confirmed&q=ada");
  });

  it("passes filtered registrations to the interactive table", async () => {
    mocks.listRegistrations.mockResolvedValue([
      {
        id: "reg-1",
        status: "confirmed",
        createdAt: new Date("2026-10-01T12:00:00Z"),
        utmSource: "newsletter",
        attendees: [{ id: "att-1", fullName: "Ada Lovelace", email: "ada@example.com", checkedInAt: null }],
      },
    ]);

    const result = await RegistrationsPage({ params: params("event-1"), searchParams: searchParams() });

    expect(JSON.stringify(result)).toContain("Workshop de Marketing");
     expect(JSON.stringify(result)).toContain('"registrations"');
     expect(JSON.stringify(result)).toContain('"eventId":"event-1"');
  });
});
