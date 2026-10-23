// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  saveBenefitsConfigurationAction: vi.fn(),
  annulBenefitRedemptionAction: vi.fn(),
}));

vi.mock("../benefits/actions", () => actions);
vi.mock("@base-ui/react/dialog", () => {
  return {
    Dialog: {
      Root: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (value: boolean) => void }) => {
        void onOpenChange;
        return <>{children}</>;
      },
      Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      Backdrop: () => null,
      Popup: ({ children, ...props }: { children: React.ReactNode }) => <div role="dialog" {...props}>{children}</div>,
      Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
      Description: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    },
  };
});

import { EventBenefitsEditor } from "./event-benefits-editor";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const benefits = [
  {
    id: "benefit-gift",
    eventId: "event-1",
    kind: "gift" as const,
    name: "Kit de bienvenida",
    percentage: null,
    quantity: 5,
    active: true,
    createdAt: new Date("2026-10-20T10:00:00Z"),
    updatedAt: new Date("2026-10-20T10:00:00Z"),
  },
];

function renderEditor(overrides: Partial<ComponentProps<typeof EventBenefitsEditor>> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <EventBenefitsEditor
        eventId="event-1"
        scope="attendee"
        scopeLocked={false}
        benefits={benefits}
        {...overrides}
      />,
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

describe("EventBenefitsEditor", () => {
  it("renders scope, kind-specific gift fields, capped stock, and remaining quantity", () => {
    const rendered = renderEditor({ remainingByBenefitId: { "benefit-gift": 2 } });

    expect(rendered.textContent).toContain("Alcance del canje");
    expect(rendered.textContent).toContain("Nombre del regalo");
    expect(rendered.textContent).toContain("Cantidad máxima");
    expect(rendered.textContent).toContain("Disponibles: 2 de 5");
    expect(rendered.querySelector('input[name="name"]')).not.toBeNull();
    expect(rendered.querySelector('input[name="quantity"]')).not.toBeNull();
  });

  it("disables scope controls and explains the lock after the first redemption", () => {
    const rendered = renderEditor({ scopeLocked: true });

    expect(rendered.textContent).toContain("El alcance está bloqueado porque ya existe un canje");
    expect(rendered.querySelector('[aria-label="Alcance del canje"]')).toHaveProperty("disabled", true);
  });

  it("shows discount percentage and unlimited stock controls for a new benefit", () => {
    const rendered = renderEditor({ benefits: [] });

    expect(rendered.textContent).toContain("Porcentaje de descuento");
    expect(rendered.textContent).toContain("Sin límite");
    expect(rendered.querySelector('input[name="percentage"]')).not.toBeNull();
    expect(rendered.querySelector('input[name="quantity"]:not([type="hidden"])')).toBeNull();
  });

  it("does not render redemption history in the benefits editor", () => {
    const rendered = renderEditor();

    expect(rendered.textContent).not.toContain("Historial de canjes");
    expect(rendered.textContent).not.toContain("Anular");
  });

  it("renders one configuration save button and no per-row save buttons", () => {
    const rendered = renderEditor();

    expect(rendered.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(rendered.textContent).toContain("Guardar cambios");
    expect(rendered.textContent).not.toContain("Guardar beneficio");
    expect(rendered.textContent).not.toContain("Guardar alcance");
  });
});
