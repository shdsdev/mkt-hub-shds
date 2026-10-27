// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("./add-companion-row", () => ({ AddCompanionRow: () => null }));
vi.mock("./registration-detail-sheet", () => ({ RegistrationDetailSheet: () => null }));

import { RegistrationsTable } from "./registrations-table";

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

describe("RegistrationsTable", () => {
  it("does not capture the pointer for a normal row click", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <RegistrationsTable
        registrations={[]}
        eventId="event-1"
        eventName="Workshop"
        collectCompany={false}
        collectJobTitle={false}
        statusLabels={{ pending_review: "Pendiente", confirmed: "Confirmado", waitlisted: "Lista de espera", rejected: "Rechazado", cancelled: "Cancelado", checked_in: "Check-in" }}
        reviewStatusLabels={{ new: "Nuevo", in_review: "En revisión", approved: "Aprobado", waitlisted: "Lista de espera", rejected: "Rechazado" }}
      />,
    ));

    const table = container.querySelector("div.overflow-x-auto");
    expect(table).not.toBeNull();
    const setPointerCapture = vi.fn();
    table!.setPointerCapture = setPointerCapture;

    act(() => {
      const event = new MouseEvent("pointerdown", { bubbles: true, clientX: 100 });
      Object.defineProperty(event, "pointerId", { value: 1 });
      table!.dispatchEvent(event);
    });

    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it("refreshes registration data every ten seconds and clears polling on unmount", () => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <RegistrationsTable
        registrations={[]}
        eventId="event-1"
        eventName="Workshop"
        collectCompany={false}
        collectJobTitle={false}
        statusLabels={{ pending_review: "Pendiente", confirmed: "Confirmado", waitlisted: "Lista de espera", rejected: "Rechazado", cancelled: "Cancelado", checked_in: "Check-in" }}
        reviewStatusLabels={{ new: "Nuevo", in_review: "En revisión", approved: "Aprobado", waitlisted: "Lista de espera", rejected: "Rechazado" }}
      />,
    ));

    act(() => vi.advanceTimersByTime(10_000));
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => root?.unmount());
    root = undefined;
    act(() => vi.advanceTimersByTime(10_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
