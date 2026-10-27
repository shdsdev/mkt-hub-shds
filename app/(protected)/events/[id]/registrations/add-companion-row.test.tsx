// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { addCompanionAction } = vi.hoisted(() => ({ addCompanionAction: vi.fn() }));

vi.mock("./actions", () => ({ addCompanionAction }));
vi.mock("../../companion-added-dialog", () => ({ CompanionAddedDialog: () => null }));
vi.mock("@base-ui/react/dialog", () => ({
  Dialog: {
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Backdrop: () => null,
    Popup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  },
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AddCompanionRow } from "./add-companion-row";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
});

describe("AddCompanionRow", () => {
  it("shows the configured phone field in the add companion modal", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <AddCompanionRow
        registrationId="registration-1"
        eventId="event-1"
        collectCompany={true}
        collectJobTitle={true}
        phoneRequired={true}
      />,
    ));

    act(() => container?.querySelector<HTMLButtonElement>("button[aria-label='Agregar acompañante']")?.click());

    const phone = container?.querySelector<HTMLInputElement>("input[name='phone']");
    expect(phone).not.toBeNull();
    expect(phone?.type).toBe("tel");
    expect(phone?.required).toBe(true);
    expect(phone?.getAttribute("aria-label")).toBe("Teléfono del acompañante");
  });
});
