// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/events/event-1/registrations",
  useRouter: () => ({ replace }),
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { button: "button", span: "span" },
  useReducedMotion: () => false,
}));

import { RegistrationFilters } from "./registration-filters";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("RegistrationFilters", () => {
  it("updates the search after the debounce delay", () => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <RegistrationFilters sort="recent" pageSize={25} />,
    ));

    const input = container.querySelector<HTMLInputElement>("input[placeholder='Buscar nombre, correo o empresa']");
    expect(input).not.toBeNull();
    act(() => {
      Object.defineProperty(input, "value", { value: "Ada", writable: true });
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      vi.advanceTimersByTime(349);
    });
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledWith(
      "/events/event-1/registrations?q=Ada&sort=recent&pageSize=25",
      { scroll: false },
    );
  });

  it("clears filters while preserving sort and page size", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <RegistrationFilters
        status="confirmed"
        q="Ada"
        reviewStatus="approved"
        source="Meta Ads"
        occupation="manufacturer"
        state="Jalisco"
        sort="name"
        pageSize={50}
      />,
    ));

    const clearButton = container.querySelector<HTMLButtonElement>("button[aria-label='Limpiar filtros']");
    expect(clearButton).not.toBeNull();

    act(() => clearButton?.click());

    expect(replace).toHaveBeenCalledWith(
      "/events/event-1/registrations?sort=name&pageSize=50",
      { scroll: false },
    );
  });
});
