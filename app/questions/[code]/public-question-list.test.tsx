// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh, voteQuestionAction } = vi.hoisted(() => ({
  refresh: vi.fn(),
  voteQuestionAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("./actions", () => ({
  submitQuestionAction: vi.fn(),
  voteQuestionAction,
}));

import { PublicQuestionList } from "./public-question-list";

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

describe("PublicQuestionList", () => {
  it("refreshes every three seconds and clears polling on unmount", () => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(<PublicQuestionList code="ABC123" questions={[]} />));
    act(() => vi.advanceTimersByTime(3000));

    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => root?.unmount());
    root = undefined;
    act(() => vi.advanceTimersByTime(3000));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("optimistically toggles a question like and exposes its accessible state", async () => {
    voteQuestionAction.mockResolvedValue({ voted: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <PublicQuestionList
        code="ABC123"
        questions={[{
          id: "question-1",
          text: "¿Cuál es la pregunta?",
          status: "approved",
          answerText: null,
          publishedAt: null,
          createdAt: new Date(),
          voteCount: 2,
          hasVoted: false,
        }]}
      />,
    ));

    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Votar pregunta"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("2");

    await act(async () => button?.click());

    expect(container.querySelector('button[aria-label="Quitar voto"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Quitar voto"]')?.textContent).toContain("3");
  });

  it("reconciles the latest polling snapshot after a pending vote completes", async () => {
    let resolveVote: (state: { voted: boolean }) => void = () => undefined;
    const pendingVote = new Promise<{ voted: boolean }>((resolve) => {
      resolveVote = resolve;
    });
    voteQuestionAction.mockReturnValue(pendingVote);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    const question = {
      id: "question-1",
      text: "¿Cuál es la pregunta?",
      status: "approved" as const,
      answerText: null,
      publishedAt: null,
      createdAt: new Date(),
      voteCount: 2,
      hasVoted: false,
    };

    act(() => root?.render(<PublicQuestionList code="ABC123" questions={[question]} />));
    await act(async () => {
      container?.querySelector<HTMLButtonElement>('button[aria-label="Votar pregunta"]')?.click();
    });

    act(() => root?.render(
      <PublicQuestionList
        code="ABC123"
        questions={[{ ...question, voteCount: 4, hasVoted: true }]}
      />,
    ));
    resolveVote({ voted: true });
    await act(async () => pendingVote);

    const button = container?.querySelector<HTMLButtonElement>('button[aria-label="Quitar voto"]');
    expect(button?.textContent).toContain("4");
  });

  it("rolls back the optimistic like and reports a server error", async () => {
    voteQuestionAction.mockResolvedValue({ error: "No pudimos actualizar tu voto." });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <PublicQuestionList
        code="ABC123"
        questions={[{
          id: "question-1",
          text: "¿Cuál es la pregunta?",
          status: "approved",
          answerText: null,
          publishedAt: null,
          createdAt: new Date(),
          voteCount: 2,
          hasVoted: false,
        }]}
      />,
    ));

    await act(async () => container?.querySelector<HTMLButtonElement>('button[aria-label="Votar pregunta"]')?.click());

    expect(container.querySelector('button[aria-label="Votar pregunta"]')?.textContent).toContain("2");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("No pudimos actualizar");
  });
});
