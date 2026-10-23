// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  archiveEventAction: vi.fn(),
  restoreEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));
import { EventCard } from "./event-card";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("EventCard", () => {
  it("renders one dashboard link with event details and explicit lifecycle actions", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <EventCard
          event={{
            id: "event-1",
            organizationId: "org-1",
            name: "Launch Day",
            slug: "launch-day",
            status: "published",
             description: null,
            startsAt: new Date("2026-11-01T18:00:00Z"),
            endsAt: null,
            location: "Hotel Victoria",
            locationUrl: null,
            capacity: 100,
            reminderOffsetMinutes: null,
            checkInConfirmationRequired: true,
            collectCompany: false,
            collectJobTitle: false,
            registrationFormConfig: null,
             emailContent: null,
             benefitRedemptionScope: null,
             benefitRedemptionStartedAt: null,
             heroImageUrl: null,
            agenda: [],
            sponsorLogos: [],
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            utmTerm: null,
            utmContent: null,
            utmId: null,
            visitCount: 0,
            webhookUrl: null,
             webhookSecret: null,
             telegramChatId: null,
             telegramMessageTemplate: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          }}
        />,
      );
    });

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/events/event-1/dashboard");
    expect(link?.textContent).toContain("Launch Day");
    expect(link?.textContent).toContain("Publicado");
    expect(link?.textContent).toContain("100");
    expect(link?.textContent).not.toContain("Archivar");
    expect(container?.querySelectorAll("a")).toHaveLength(1);
    expect(container?.querySelector('button[aria-label="Archivar evento"]')).toBeTruthy();
    expect(container?.querySelector('button[aria-label="Eliminar evento"]')).toBeTruthy();
    expect(link?.textContent).toContain("Contexto");
    expect(link?.textContent).toContain("Sin contexto");
    expect(link?.className).not.toContain("min-h-56");
  });

  it("shows restore instead of archive for archived events", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<EventCard event={{ status: "archived", id: "event-1" } as never} />));

    expect(container.querySelector('button[aria-label="Restaurar evento"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Archivar evento"]')).toBeNull();
  });

  it("routes Reception to registrations without admin actions", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <EventCard
          role="RECEPTION"
          event={{ id: "event-1", status: "published", name: "Launch Day" } as never}
        />,
      ),
    );

    expect(container.querySelector("a")?.getAttribute("href")).toBe("/events/event-1/registrations");
    expect(container.querySelector('button[aria-label="Archivar evento"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Eliminar evento"]')).toBeNull();
  });
});
