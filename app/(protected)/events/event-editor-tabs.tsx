"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type EventEditorTab = {
  id: string;
  label: ReactNode;
};

type EventEditorTabPanelProps = {
  id: string;
  active: boolean;
  children: ReactNode;
};

type EventEditorTabsProps = {
  tabs: readonly EventEditorTab[];
  defaultTab?: string;
  formTabIds?: readonly string[];
  renderMainForm?: (children: ReactNode) => ReactNode;
  children: ReactNode;
};

function getInitialTab(tabs: readonly EventEditorTab[], defaultTab?: string): string {
  return tabs.some((tab) => tab.id === defaultTab) ? defaultTab! : tabs[0]?.id ?? "";
}

export function EventEditorTabs({
  tabs,
  defaultTab,
  formTabIds,
  renderMainForm,
  children,
}: EventEditorTabsProps) {
  const [activeTab, setActiveTab] = useState(() => getInitialTab(tabs, defaultTab));
  const instanceId = useId().replace(/:/g, "");

  function selectTab(tabId: string) {
    setActiveTab(tabId);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = tabs.findIndex((tab) => tab.id === event.currentTarget.dataset.tabId);
    if (currentIndex < 0 || tabs.length === 0) return;

    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectTab(nextTab.id);
    document.getElementById(`${instanceId}-tab-${nextTab.id}`)?.focus();
  }

  const renderedPanels = Children.toArray(children).map((child) => {
    if (!isValidElement<EventEditorTabPanelProps>(child)) return child;
    return cloneElement(child, {
      active: child.props.id === activeTab,
      panelId: `${instanceId}-panel-${child.props.id}`,
      tabId: `${instanceId}-tab-${child.props.id}`,
    } as Partial<EventEditorTabPanelProps>);
  });
  const formPanelIds = new Set(formTabIds);
  const mainFormPanels = formTabIds
    ? renderedPanels.filter(
        (child) => isValidElement<EventEditorTabPanelProps>(child) && formPanelIds.has(child.props.id),
      )
    : renderedPanels;
  const externalPanels = formTabIds
    ? renderedPanels.filter(
        (child) => isValidElement<EventEditorTabPanelProps>(child) && !formPanelIds.has(child.props.id),
      )
    : [];

  return (
    <div>
      <div role="tablist" aria-label="Editor del evento" className="flex w-full min-w-0 gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          const tabId = `${instanceId}-tab-${tab.id}`;
          const panelId = `${instanceId}-panel-${tab.id}`;

          return (
            <button
              key={tab.id}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              data-tab-id={tab.id}
              className="min-h-11 shrink-0 whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-primary aria-selected:text-foreground"
              onClick={() => selectTab(tab.id)}
              onKeyDown={handleTabKeyDown}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {renderMainForm ? renderMainForm(mainFormPanels) : mainFormPanels}
      {externalPanels}
    </div>
  );
}

export function EventEditorTabPanel({
  id,
  active,
  children,
  panelId,
  tabId,
}: EventEditorTabPanelProps & { panelId?: string; tabId?: string }) {
  return (
    <section
      id={panelId ?? `event-editor-panel-${id}`}
      role="tabpanel"
      aria-labelledby={tabId ?? `event-editor-tab-${id}`}
      hidden={!active}
      tabIndex={0}
    >
      {children}
    </section>
  );
}
