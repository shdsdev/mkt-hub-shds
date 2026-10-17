// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EventBasicFields } from "./event-basic-fields";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("EventBasicFields date and time controls", () => {
  it("replaces native date and time inputs while preserving serialized fields", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<EventBasicFields />));

    expect(container.querySelectorAll('input[type="date"], input[type="time"]')).toHaveLength(0);
    expect(container.querySelector('input[name="startDate"]')).toBeTruthy();
    expect(container.querySelector('input[name="startTime"]')).toBeTruthy();
    expect(container.querySelector('input[name="startsAt"]')).toBeTruthy();
    expect(container.querySelector('input[name="endsAt"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Seleccionar fecha de inicio"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Seleccionar hora de inicio"]')).toBeTruthy();
  });

  it("renders all half-hour choices when a time selector opens", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<EventBasicFields />));
    act(() => container?.querySelector<HTMLButtonElement>('button[aria-label="Seleccionar hora de inicio"]')?.click());

    expect(document.body.textContent).toContain("00:00");
    expect(document.body.textContent).toContain("23:30");
    expect(document.body.querySelectorAll('button[data-time-option="true"]')).toHaveLength(48);
  });
});
