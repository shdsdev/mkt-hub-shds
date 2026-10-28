// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { EventAuditLogTable, filterAuditLogs, type EventAuditLogRow } from "./event-audit-log-table";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const logs: EventAuditLogRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    action: "event_send",
    resourceType: "event_notification",
    actor: "admin@example.com",
    actorType: "user",
    when: "1/10/2026, 10:00:00",
    dateKey: "2026-10-01",
    before: null,
    after: { kind: "confirmation", recipient: "alan@example.com", result: "sent" },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    action: "event_send_failed",
    resourceType: "event_notification",
    actor: "Sistema",
    actorType: "system",
    when: "1/10/2026, 11:00:00",
    dateKey: "2026-10-01",
    before: null,
    after: { kind: "reminder", recipient: "grace@example.com", result: "failed" },
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    action: "event_change",
    resourceType: "event",
    actor: "admin@example.com",
    actorType: "user",
    when: "2/10/2026, 09:00:00",
    dateKey: "2026-10-02",
    before: { capacity: 10 },
    after: { capacity: 20 },
  },
];

function renderTable() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<EventAuditLogTable logs={logs} />));
  return container;
}

describe("EventAuditLogTable", () => {
  it("renders every action as a human sentence with its actor", () => {
    const rendered = renderTable();

    expect(rendered.textContent).toContain("Envió la confirmación a alan@example.com");
    expect(rendered.textContent).toContain("No se pudo enviar el recordatorio a grace@example.com");
    expect(rendered.textContent).toContain("Editó el evento");
    expect(rendered.textContent).toContain("Sistema");
    expect(rendered.textContent).toContain("admin@example.com");
  });

  it("filters to failed sends only", () => {
    const failed = filterAuditLogs(logs, { resource: "all", result: "failed", date: "" });

    expect(failed).toHaveLength(1);
    expect(failed[0]?.action).toBe("event_send_failed");
  });

  it("filters by section and date together", () => {
    const filtered = filterAuditLogs(logs, { resource: "event", result: "all", date: "2026-10-02" });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.action).toBe("event_change");
  });

  it("renders premium dropdown triggers instead of native selects", () => {
    const rendered = renderTable();

    expect(rendered.querySelectorAll("select")).toHaveLength(0);
    const triggers = rendered.querySelectorAll('[aria-label="Filtrar por sección"], [aria-label="Filtrar por resultado"]');
    expect(triggers).toHaveLength(2);
    triggers.forEach((trigger) => expect(trigger.className).toContain("rounded-xl"));
  });

  it("renders the date filter as a premium calendar popover, not a native date input", () => {
    const rendered = renderTable();

    expect(rendered.querySelectorAll('input[type="date"]')).toHaveLength(0);
    const dateTrigger = rendered.querySelector('[aria-label="Filtrar por fecha"]') as HTMLElement;
    expect(dateTrigger).not.toBeNull();
    expect(dateTrigger.tagName).toBe("BUTTON");
    expect(dateTrigger.className).toContain("rounded-xl");
    expect(dateTrigger.textContent).toContain("Todas las fechas");
  });

  it("expands a change into readable field updates without raw JSON", () => {
    const rendered = renderTable();
    const changeRow = [...rendered.querySelectorAll("tr")].find((row) => row.textContent?.includes("Editó el evento")) as HTMLTableRowElement;

    act(() => changeRow.click());

    expect(rendered.textContent).toContain("Capacidad:");
    expect(rendered.textContent).toContain("10");
    expect(rendered.textContent).toContain("20");
    expect(rendered.querySelector("pre")).toBeNull();
    expect(rendered.textContent).not.toContain('"capacity"');
    expect(rendered.querySelector(".font-mono")).not.toBeNull();
  });
});
