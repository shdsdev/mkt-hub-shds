import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedEventBySlugPublic: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/modules/events", () => ({
  getPublishedEventBySlugPublic: mocks.getPublishedEventBySlugPublic,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./register-form", () => ({
  RegisterForm: ({ slug, utm }: { slug: string; utm: Record<string, string | undefined> }) => (
    <div data-slug={slug} data-utm-source={utm.utmSource} />
  ),
}));

import EventLandingPage from "./page";

const publishedEvent = {
  id: "event-1",
  organizationId: "org-1",
  name: "Workshop de Marketing",
  slug: "workshop-marketing",
  status: "published" as const,
  description: "Aprende a medir tus campañas.",
  location: "CDMX",
  startsAt: new Date("2026-11-01T18:00:00Z"),
  endsAt: new Date("2026-11-01T20:00:00Z"),
  capacity: 50,
  reminderOffsetMinutes: null,
  collectCompany: true,
  collectJobTitle: false,
};

function makeParams(slug: string) {
  // The route's dynamic segment is named `id` (not `slug`) to satisfy Next.js's cross-route-group
  // param-naming constraint — see page.tsx's comment. The value is still the event's slug.
  return Promise.resolve({ id: slug });
}

function makeSearchParams(entries: Record<string, string | undefined> = {}) {
  return Promise.resolve(entries);
}

describe("EventLandingPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("returns notFound when no published event matches the slug (draft or unknown)", async () => {
    mocks.getPublishedEventBySlugPublic.mockResolvedValue(undefined);

    await expect(
      EventLandingPage({ params: makeParams("workshop-marketing"), searchParams: makeSearchParams() }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getPublishedEventBySlugPublic).toHaveBeenCalledWith("workshop-marketing");
  });

  it("renders the hero, agenda, and location for a published event", async () => {
    mocks.getPublishedEventBySlugPublic.mockResolvedValue(publishedEvent);

    const result = await EventLandingPage({
      params: makeParams("workshop-marketing"),
      searchParams: makeSearchParams(),
    });

    expect(JSON.stringify(result)).toContain("Workshop de Marketing");
    expect(JSON.stringify(result)).toContain("CDMX");
  });

  it("passes the slug and captured UTM source through to the registration form", async () => {
    mocks.getPublishedEventBySlugPublic.mockResolvedValue(publishedEvent);

    const result = await EventLandingPage({
      params: makeParams("workshop-marketing"),
      searchParams: makeSearchParams({ utm_source: "newsletter" }),
    });

    expect(JSON.stringify(result)).toContain("workshop-marketing");
    expect(JSON.stringify(result)).toContain("newsletter");
  });
});
