// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EventBasicFields } from "./event-basic-fields";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function renderFields(event?: Parameters<typeof EventBasicFields>[0]["event"]) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<EventBasicFields event={event} />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("EventBasicFields date/time requirements", () => {
  it("does not render the reminder field when creating or editing", () => {
    renderFields();
    expect(container?.querySelector('input[name="reminderOffsetMinutes"]')).toBeNull();

    renderFields({
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00"),
      endsAt: null,
      location: null,
      locationUrl: null,
      capacity: null,
    });

    expect(container?.querySelector('input[name="reminderOffsetMinutes"]')).toBeNull();
  });

  it("requires the event date and start time when creating", () => {
    renderFields();

    expect(container?.querySelector('input[name="startDate"]')).toHaveProperty("required", true);
    expect(container?.querySelector('input[name="startTime"]')).toHaveProperty("required", true);
  });

  it("requires the event date and start time when editing", () => {
    renderFields({
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00"),
      endsAt: null,
       location: null,
       locationUrl: null,
       capacity: null,
    });

    expect(container?.querySelector('input[name="startDate"]')).toHaveProperty("required", true);
    expect(container?.querySelector('input[name="startTime"]')).toHaveProperty("required", true);
  });

  it("shows date/time labels and serializes populated start and end values", () => {
    renderFields({
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date(2026, 10, 1, 18, 0),
      endsAt: new Date(2026, 10, 1, 20, 30),
       location: null,
       locationUrl: null,
       capacity: null,
    });

    const labels = [...(container?.querySelectorAll("label") ?? [])].map((label) => label.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Fecha del evento", "Hora de inicio", "Fecha de finalización (opcional)", "Hora de finalización (opcional)"]));
    expect(container?.querySelector('input[name="startsAt"]')).toHaveProperty("value", "2026-11-01T18:00");
     expect(container?.querySelector('input[name="endsAt"]')).toHaveProperty("value", "2026-11-01T20:30");
   });

  it("renders the separate Maps URL field without a reminder control", () => {
    renderFields();

    expect(container?.querySelector('input[name="reminderOffsetMinutes"]')).toBeNull();
    expect(container?.querySelector('input[name="locationUrl"]')).toHaveProperty("type", "url");
    expect(container?.textContent).toContain("Ubicación del evento");
    expect(container?.textContent).toContain("Liga directa de Google Maps (opcional)");
  });

  it("preserves the Maps URL while editing without rendering a reminder control", () => {
    renderFields({
      name: "Launch Day",
      slug: "launch-day",
      startsAt: new Date("2026-11-01T18:00"),
      endsAt: null,
      location: "Hotel Victoria",
      locationUrl: "https://maps.google.com/?q=hotel",
       capacity: null,
    });

    expect(container?.querySelector('input[name="reminderOffsetMinutes"]')).toBeNull();
    expect(container?.querySelector('input[name="locationUrl"]')).toHaveProperty("value", "https://maps.google.com/?q=hotel");
  });
});
