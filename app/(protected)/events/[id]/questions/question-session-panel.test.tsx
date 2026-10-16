// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createQuestionSessionAction, closeQuestionSessionAction, refresh } = vi.hoisted(() => ({
  createQuestionSessionAction: vi.fn(),
  closeQuestionSessionAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  createQuestionSessionAction,
  closeQuestionSessionAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { QuestionSessionPanel } from "./question-session-panel";
import { QuestionLiveRefresh } from "./question-live-refresh";

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

describe("QuestionSessionPanel", () => {
  it("renders persisted code, public URL, and QR without an action result", () => {
    const session = {
      id: "session-1",
      eventId: "event-1",
      organizationId: "org-1",
      codeHash: "hash",
      displayCode: "ABC123",
      status: "open" as const,
      codeCreatedAt: new Date("2026-01-01T00:00:00Z"),
      closedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<QuestionSessionPanel eventId="event-1" session={session} publicUrl="https://example.com/questions/ABC123" />));

    expect(container.textContent).toContain("ABC123");
    expect(container.textContent).toContain("https://example.com/questions/ABC123");
    expect(container.querySelector('img[alt="Código QR para preguntas"]')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain("Regenerar código");
  });

  it("refreshes every three seconds and clears polling on unmount", () => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<QuestionLiveRefresh><span>Preguntas</span></QuestionLiveRefresh>));
    act(() => vi.advanceTimersByTime(3000));

    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => root?.unmount());
    root = undefined;
    act(() => vi.advanceTimersByTime(3000));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
