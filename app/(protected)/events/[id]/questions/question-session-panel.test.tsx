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
       publicToken: "public-token-1",
       accessCodeHash: "access-hash",
      status: "open" as const,
      codeCreatedAt: new Date("2026-01-01T00:00:00Z"),
      closedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<QuestionSessionPanel eventId="event-1" session={session} publicUrl="https://example.com/questions/public-token-1" />));

    expect(container.textContent).toContain("ABC123");
    expect(container.textContent).toContain("https://example.com/questions/public-token-1");
    expect(container.querySelector('img[alt="Código QR para preguntas"]')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain("Regenerar código");
  });

  it("renders generated access artifacts immediately when no session is persisted yet", async () => {
    createQuestionSessionAction.mockResolvedValue({
      success: "Código generado.",
      code: "NEW456",
      publicToken: "public-token-2",
      publicUrl: "https://example.com/questions/public-token-2",
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<QuestionSessionPanel eventId="event-1" />));
    await act(async () => {
      container?.querySelector("form")?.requestSubmit();
    });

    expect(container.textContent).toContain("NEW456");
    expect(container.textContent).toContain("https://example.com/questions/public-token-2");
    expect(container.querySelector('img[alt="Código QR para preguntas"]')).not.toBeNull();
  });

  it("makes a closed session explicit without rendering its inactive access code or QR", () => {
    const session = {
      id: "session-1",
      eventId: "event-1",
      organizationId: "org-1",
       codeHash: "hash",
       displayCode: "ABC123",
       publicToken: "public-token-1",
       accessCodeHash: "access-hash",
       status: "closed" as const,
      codeCreatedAt: new Date("2026-01-01T00:00:00Z"),
      closedAt: new Date("2026-01-02T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<QuestionSessionPanel eventId="event-1" session={session} publicUrl="https://example.com/questions/ABC123" />));

    expect(container.textContent).toContain("La sesión está cerrada.");
    expect(container.textContent).not.toContain("ABC123");
    expect(container.textContent).not.toContain("https://example.com/questions/ABC123");
    expect(container.querySelector('img[alt="Código QR para preguntas"]')).toBeNull();
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain("Generar código");
  });

  it("clears action-generated access artifacts when polling observes a closed session", async () => {
    const openSession = {
      id: "session-1",
      eventId: "event-1",
      organizationId: "org-1",
       codeHash: "hash",
       displayCode: "ABC123",
       publicToken: "public-token-1",
       accessCodeHash: "access-hash",
       status: "open" as const,
      codeCreatedAt: new Date("2026-01-01T00:00:00Z"),
      closedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    const closedSession = {
      ...openSession,
      status: "closed" as const,
      closedAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    };
    createQuestionSessionAction.mockResolvedValue({
      success: "Código generado.",
      code: "NEW456",
      publicToken: "public-token-2",
      publicUrl: "https://example.com/questions/public-token-2",
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<QuestionSessionPanel eventId="event-1" session={openSession} publicUrl="https://example.com/questions/ABC123" />));
    await act(async () => {
      container?.querySelector("form")?.requestSubmit();
    });

    expect(container.textContent).toContain("NEW456");
    expect(container.textContent).toContain("https://example.com/questions/public-token-2");

    act(() => root?.render(<QuestionSessionPanel eventId="event-1" session={closedSession} publicUrl="https://example.com/questions/ABC123" />));

    expect(container.textContent).not.toContain("NEW456");
    expect(container.textContent).not.toContain("https://example.com/questions/public-token-2");
    expect(container.querySelector('img[alt="Código QR para preguntas"]')).toBeNull();
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
