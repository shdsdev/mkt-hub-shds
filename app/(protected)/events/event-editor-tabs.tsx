"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
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
  const dragState = useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    suppressClick: false,
  });

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

  function handleTabListPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
      suppressClick: false,
    };
    if (event.target === event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handleTabListPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragState.current.pointerId !== event.pointerId) return;

    const delta = event.clientX - dragState.current.startX;
    if (Math.abs(delta) > 4) dragState.current.moved = true;
    event.currentTarget.scrollLeft = dragState.current.startScrollLeft - delta;
  }

  function handleTabListPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragState.current.pointerId !== event.pointerId) return;

    dragState.current.suppressClick = dragState.current.moved;
    dragState.current.pointerId = -1;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleTabClick(tabId: string) {
    if (dragState.current.suppressClick) {
      dragState.current.suppressClick = false;
      return;
    }
    selectTab(tabId);
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
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Editor del evento"
        className="event-editor-tablist flex w-full min-w-0 cursor-grab touch-pan-x select-none gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1 active:cursor-grabbing"
        onPointerDown={handleTabListPointerDown}
        onPointerMove={handleTabListPointerMove}
        onPointerUp={handleTabListPointerUp}
        onPointerCancel={handleTabListPointerUp}
      >
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
              className="min-h-10 shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-background/70 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:shadow-sm"
              onClick={() => handleTabClick(tab.id)}
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
