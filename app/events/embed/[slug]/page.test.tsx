import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedEventBySlugPublic: vi.fn(),
  resolveRegistrationFormConfig: vi.fn(() => ({
    version: 1,
    fields: {
      phone: { visible: false, required: false },
      company: { visible: true, required: false },
      jobTitle: { visible: false, required: false },
    },
    companion: { enabled: true },
    clientBrands: { enabled: false, options: [] },
    interests: { enabled: false, options: [] },
    consent: {
      privacy: { url: "/privacy", text: "Privacidad" },
      terms: { url: "/terms", text: "Términos" },
      marketing: { enabled: false, text: "Marketing" },
    },
  })),
}));

vi.mock("@/modules/events", () => ({
  getPublishedEventBySlugPublic: mocks.getPublishedEventBySlugPublic,
  resolveRegistrationFormConfig: mocks.resolveRegistrationFormConfig,
}));
vi.mock("../../[id]/register-form", () => ({
  RegisterForm: ({ slug, utm }: { slug: string; utm: Record<string, string | undefined> }) => (
    <div data-slug={slug} data-utm-source={utm.utmSource} />
  ),
}));

import EmbedEventPage from "./page";

const publishedEvent = {
  id: "event-1",
  organizationId: "org-1",
  name: "Workshop de Marketing",
  slug: "workshop-marketing",
  status: "published" as const,
  collectCompany: true,
  collectJobTitle: false,
};

describe("EmbedEventPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders only the registration form for a published event", async () => {
    mocks.getPublishedEventBySlugPublic.mockResolvedValue(publishedEvent);

    const result = await EmbedEventPage({
      params: Promise.resolve({ slug: "workshop-marketing" }),
      searchParams: Promise.resolve({ utm_source: "newsletter" }),
    });

    expect(JSON.stringify(result)).toContain("workshop-marketing");
    expect(JSON.stringify(result)).toContain("newsletter");
    expect(JSON.stringify(result)).not.toContain("Agenda");
    expect(mocks.getPublishedEventBySlugPublic).toHaveBeenCalledWith("workshop-marketing");
  });

  it("renders a controlled unavailable state for an unavailable event", async () => {
    mocks.getPublishedEventBySlugPublic.mockResolvedValue(undefined);

    const result = await EmbedEventPage({
      params: Promise.resolve({ slug: "workshop-marketing" }),
      searchParams: Promise.resolve({}),
    });

    expect(JSON.stringify(result)).toMatch(/no está disponible/i);
    expect(JSON.stringify(result)).not.toContain("event-1");
  });
});
