// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EventEditorTabPanel, EventEditorTabs } from "./event-editor-tabs";

const tabs = [
  { id: "event", label: "Datos del evento" },
  { id: "landing", label: "Landing" },
  { id: "email", label: "Correos" },
  { id: "registration", label: "Registro" },
  { id: "integrations", label: "Integraciones" },
] as const;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function renderTabs(defaultTab = "event") {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <EventEditorTabs tabs={tabs} defaultTab={defaultTab}>
        {tabs.map((tab) => (
          <EventEditorTabPanel key={tab.id} id={tab.id} active={false}>
            {tab.id === "event" ? (
              <>
                <label htmlFor="name">Nombre</label>
                <input id="name" />
              </>
            ) : (
              tab.label
            )}
          </EventEditorTabPanel>
        ))}
      </EventEditorTabs>,
    );
  });

  return container;
}

function tabByName(name: string) {
  return [...(container?.querySelectorAll('[role="tab"]') ?? [])].find(
    (tab) => tab.textContent === name,
  ) as HTMLButtonElement;
}

function panelById(id: string) {
  return container?.querySelector<HTMLElement>(`#${id}`);
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("EventEditorTabs", () => {
  it("keeps integration panels outside the main form boundary", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <EventEditorTabs
          tabs={tabs}
          formTabIds={["event", "landing", "email", "registration"]}
          renderMainForm={(children) => <form data-testid="main-form">{children}</form>}
        >
          <EventEditorTabPanel id="event" active={false}>Event fields</EventEditorTabPanel>
          <EventEditorTabPanel id="landing" active={false}>Landing fields</EventEditorTabPanel>
          <EventEditorTabPanel id="email" active={false}>Email fields</EventEditorTabPanel>
          <EventEditorTabPanel id="registration" active={false}>Registration fields</EventEditorTabPanel>
          <EventEditorTabPanel id="integrations" active={false}>
            <form data-testid="webhook-form">Webhook fields</form>
          </EventEditorTabPanel>
        </EventEditorTabs>,
      );
    });

    const mainForm = container.querySelector('[data-testid="main-form"]');
    const webhookForm = container.querySelector('[data-testid="webhook-form"]');
    const integrationsPanel = panelById(
      tabByName("Integraciones").getAttribute("aria-controls") ?? "",
    );

    expect(mainForm).not.toBeNull();
    expect(mainForm?.querySelectorAll('[role="tabpanel"]')).toHaveLength(4);
    expect(integrationsPanel?.parentElement).not.toBe(mainForm);
    expect(webhookForm?.closest('[data-testid="main-form"]')).toBeNull();
  });

  it("exposes accessible tabs and keeps inactive panels mounted when switching by mouse", () => {
    renderTabs();

    const renderedTabs = [...(container?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])];
    const eventTab = tabByName("Datos del evento");
    const emailTab = tabByName("Correos");
    const eventPanel = panelById(eventTab.getAttribute("aria-controls") ?? "");
    const emailPanel = panelById(emailTab.getAttribute("aria-controls") ?? "");

    expect(renderedTabs).toHaveLength(5);
    renderedTabs.forEach((tab) => {
      const panel = panelById(tab.getAttribute("aria-controls") ?? "");

      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    });

    expect(eventTab.getAttribute("aria-selected")).toBe("true");
    expect(eventTab.getAttribute("aria-controls")).toBe(eventPanel?.id);
    expect(eventPanel?.getAttribute("aria-labelledby")).toBe(eventTab.id);
    expect(emailPanel?.getAttribute("aria-labelledby")).toBe(emailTab.id);
    expect(emailTab.textContent).toBe("Correos");
    expect(emailPanel?.hasAttribute("hidden")).toBe(true);

    act(() => emailTab.click());

    expect(emailTab.getAttribute("aria-selected")).toBe("true");
    expect(emailPanel?.hasAttribute("hidden")).toBe(false);
    expect(container?.querySelector("#name")).not.toBeNull();
    expect(eventPanel?.hasAttribute("hidden")).toBe(true);
  });

  it("starts on the requested default tab", () => {
    renderTabs("email");

    const emailTab = tabByName("Correos");
    const emailPanel = panelById(emailTab.getAttribute("aria-controls") ?? "");

    expect(emailTab.getAttribute("aria-selected")).toBe("true");
    expect(emailTab.tabIndex).toBe(0);
    expect(emailPanel?.hasAttribute("hidden")).toBe(false);
    expect(tabByName("Datos del evento").tabIndex).toBe(-1);
  });

  it("moves focus with arrows and jumps to the first or last tab", () => {
    renderTabs();

    const eventTab = tabByName("Datos del evento");
    const emailTab = tabByName("Correos");
    const integrationsTab = tabByName("Integraciones");

    act(() => eventTab.focus());
    act(() => eventTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    const landingTab = tabByName("Landing");
    expect(document.activeElement).toBe(landingTab);
    expect(landingTab.getAttribute("aria-selected")).toBe("true");
    expect(landingTab.tabIndex).toBe(0);
    expect(eventTab.tabIndex).toBe(-1);

    act(() => tabByName("Landing").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(document.activeElement).toBe(eventTab);
    expect(eventTab.tabIndex).toBe(0);
    expect(landingTab.tabIndex).toBe(-1);

    act(() => emailTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(document.activeElement).toBe(eventTab);
    expect(eventTab.tabIndex).toBe(0);
    expect(emailTab.tabIndex).toBe(-1);

    act(() => eventTab.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
    expect(document.activeElement).toBe(integrationsTab);
    expect(integrationsTab.tabIndex).toBe(0);
    expect(eventTab.tabIndex).toBe(-1);

    act(() => integrationsTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(document.activeElement).toBe(eventTab);
    expect(eventTab.tabIndex).toBe(0);
    expect(integrationsTab.tabIndex).toBe(-1);
  });
});
