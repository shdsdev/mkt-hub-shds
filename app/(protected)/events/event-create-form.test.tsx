// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void }) => {
      onOpenChangeCallback = onOpenChange;
      return <>{children}</>;
    },
    Trigger: ({ children, ...props }: { children: React.ReactNode }) => <button {...props}>{children}</button>,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Backdrop: ({ className }: { className?: string }) => <div data-testid="backdrop" className={className}>{null}</div>,
    Popup: ({ children, className }: { children: React.ReactNode; className?: string }) => <div role="dialog" className={className}>{children}</div>,
    Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    Description: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  },
}));

vi.mock("./actions", () => ({
  createEventAction: vi.fn(),
}));

vi.mock("./event-registration-fields", () => ({
  EventRegistrationFields: () => <div>Configuración del formulario de registro</div>,
}));

import { EventCreateForm } from "./event-create-form";

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let onOpenChangeCallback: ((open: boolean) => void) | undefined;

const config = {
  version: 1 as const,
  customFieldsVersion: 1 as const,
  customFields: [],
  fields: {
    phone: { visible: false, required: false },
    company: { visible: false, required: false },
    jobTitle: { visible: false, required: false },
  },
  companion: { enabled: true },
  clientBrands: { enabled: false, options: [] as never[] },
  interests: { enabled: false, options: [] as never[] },
  consent: {
    privacy: { url: "/privacy", text: "Privacy" },
    terms: { url: "/terms", text: "Terms" },
    marketing: { enabled: false, text: "Marketing" },
  },
};

function renderForm() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<EventCreateForm initialFormConfig={config} />);
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  vi.restoreAllMocks();
  root = undefined;
  container = undefined;
  onOpenChangeCallback = undefined;
});

describe("EventCreateForm wizard", () => {
  it("progresses through exactly three phases and shows a review before submit", () => {
    renderForm();
    const form = container?.querySelector("form") as HTMLFormElement;
    const name = container?.querySelector('input[name="name"]') as HTMLInputElement;
    const slug = container?.querySelector('input[name="slug"]') as HTMLInputElement;
    const date = container?.querySelector('input[name="startDate"]') as HTMLInputElement;
    const time = container?.querySelector('input[name="startTime"]') as HTMLInputElement;
    const endDate = container?.querySelector('input[name="endDate"]') as HTMLInputElement;
    const endTime = container?.querySelector('input[name="endTime"]') as HTMLInputElement;
    const locationUrl = container?.querySelector('input[name="locationUrl"]') as HTMLInputElement;

    expect(container?.textContent).toContain("1 de 3");
    expect(container?.querySelectorAll("section")[1]).toHaveProperty("hidden", true);

    act(() => {
      setInputValue(name, "Launch Day");
      setInputValue(slug, "launch-day");
      setInputValue(date, "2026-11-01");
      setInputValue(time, "18:00");
      setInputValue(endDate, "2026-11-01");
      setInputValue(endTime, "21:00");
      setInputValue(locationUrl, "https://maps.google.com/?q=Hotel+Victoria");
      [...form.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Siguiente"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container?.textContent).toContain("2 de 3");
    expect(container?.textContent).toContain("Formulario de registro");

    act(() => {
      [...(container?.querySelectorAll("button") ?? [])]
        .find((button) => button.textContent?.includes("Siguiente"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container?.textContent).toContain("3 de 3");
    expect(container?.textContent).toContain("Revisá los datos antes de crear el evento");
    expect(container?.textContent).toContain("Finalización1 nov 2026, 9:00 p.m.");
    expect(container?.textContent).toContain("https://maps.google.com/?q=Hotel+Victoria");
    expect(container?.textContent).toContain("Acompañante");
    expect(container?.textContent).toContain("Permitido");
    expect(container?.textContent).toContain("Consentimiento");
    expect(container?.textContent).toContain("Privacidad y Términos");
  });

  it("keeps the first phase when required essential data is missing", () => {
    renderForm();
    const next = [...(container?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent?.includes("Siguiente"));

    act(() => next?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(container?.textContent).toContain("1 de 3");
    expect(container?.querySelector('input[name="name"]')).toHaveProperty("required", true);
  });

  it("asks for confirmation before closing a form with entered data", () => {
    renderForm();
    const name = container?.querySelector('input[name="name"]') as HTMLInputElement;
    setInputValue(name, "Launch Day");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    act(() => onOpenChangeCallback?.(false));

    expect(confirm).toHaveBeenCalledWith("¿Querés descartar los datos del evento?");
  });

  it("does not ask for confirmation while the form is pristine", () => {
    renderForm();
    const confirm = vi.spyOn(window, "confirm");

    act(() => onOpenChangeCallback?.(false));

    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps the wizard above its backdrop", () => {
    renderForm();

    expect(container?.querySelector('[data-testid="backdrop"]')?.className).toContain("z-40");
    expect(container?.querySelector('[role="dialog"]')?.className).toContain("z-50");
    expect(container?.querySelector('[role="dialog"]')?.className).toContain("top-1/2");
    expect(container?.querySelector('[role="dialog"]')?.className).toContain("left-1/2");
  });

  it("uses the same confirmation for phase-one Cancel", () => {
    renderForm();
    const name = container?.querySelector('input[name="name"]') as HTMLInputElement;
    setInputValue(name, "Launch Day");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    act(() => {
      [...(container?.querySelectorAll("button") ?? [])]
        .find((button) => button.textContent?.includes("Cancelar"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(confirm).toHaveBeenCalledWith("¿Querés descartar los datos del evento?");
  });
});
