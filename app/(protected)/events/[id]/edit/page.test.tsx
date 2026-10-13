import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isActive: vi.fn(),
  isAdmin: vi.fn(),
  getEvent: vi.fn(),
  getEventEmbedUrl: vi.fn(() => "https://hub.example.com/events/embed/workshop-mayo"),
  getEventEmbedSnippet: vi.fn(() => "<iframe />"),
  getEventLandingUrl: vi.fn(() => "https://hub.example.com/events/workshop-mayo"),
  resolveRegistrationFormConfig: vi.fn(() => ({
    version: 1,
    fields: {
      phone: { visible: false, required: false },
      company: { visible: false, required: false },
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
  notFound: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/users", () => ({ isActive: mocks.isActive, isAdmin: mocks.isAdmin }));
vi.mock("@/modules/events", () => ({
  getEvent: mocks.getEvent,
  getEventEmbedUrl: mocks.getEventEmbedUrl,
  getEventEmbedSnippet: mocks.getEventEmbedSnippet,
  getEventLandingUrl: mocks.getEventLandingUrl,
  resolveRegistrationFormConfig: mocks.resolveRegistrationFormConfig,
}));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_ORIGIN: "https://hub.example.com" } }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../../event-sub-nav", () => ({ EventSubNav: () => <div /> }));
vi.mock("./event-edit-form", () => ({
  EventEditForm: ({ landingUrl }: { landingUrl: string }) => <div>{landingUrl}</div>,
}));
vi.mock("./landing-link", () => ({
  LandingLink: ({ landingUrl }: { landingUrl: string }) => <div>{landingUrl}</div>,
}));

import EditEventPage from "./page";

const event = {
  id: "event-1",
  organizationId: "org-1",
  name: "Workshop de Marketing",
  slug: "workshop-mayo",
  status: "published" as const,
  updatedAt: new Date("2026-10-13T12:00:00Z"),
};

describe("EditEventPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ profile: { organizationId: "org-1" } });
    mocks.isActive.mockReturnValue(true);
    mocks.isAdmin.mockReturnValue(true);
    mocks.getEvent.mockResolvedValue(event);
  });

  it("generates and passes the public landing URL", async () => {
    const result = await EditEventPage({ params: Promise.resolve({ id: event.id }) });

    expect(mocks.getEventLandingUrl).toHaveBeenCalledWith("https://hub.example.com", "workshop-mayo");
    expect(JSON.stringify(result)).toContain("https://hub.example.com/events/workshop-mayo");
  });
});
