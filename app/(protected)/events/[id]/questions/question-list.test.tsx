import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ModeratorQuestion } from "@/modules/questions";

vi.mock("./actions", () => ({
  answerQuestionAction: vi.fn(),
  assignQuestionTopicAction: vi.fn(),
  moderateQuestionAction: vi.fn(),
  publishQuestionAnswerAction: vi.fn(),
  recordQuestionDuplicateAction: vi.fn(),
}));

import { QuestionList } from "./question-list";

const question: ModeratorQuestion = {
  id: "question-1",
  sessionId: "session-1",
  participantId: "participant-1",
  participantName: "Ada Lovelace",
  participantCompany: "Analytical Engines",
  text: "¿Cómo se mide el impacto?",
  normalizedText: "como se mide el impacto",
  status: "approved" as const,
  answerText: null,
  approvedBy: null,
  answeredBy: null,
  publishedBy: null,
  approvedAt: null,
  answeredAt: null,
  publishedAt: null,
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  voteCount: 2,
  topics: ["Producto"],
  similarQuestions: [],
};

describe("QuestionList", () => {
  it("keeps topic display without rendering per-question assignment controls", () => {
    const html = renderToStaticMarkup(
      <QuestionList
        eventId="event-1"
        sessionId="session-1"
        questions={[question]}
        topics={[{ id: "topic-1", name: "Producto" }]}
      />,
    );

    expect(html).toContain("Producto");
    expect(html).not.toContain("Asignar tema");
    expect(html).not.toContain("Asignar");
  });

  it("wraps moderation controls and keeps answer content below the action row", () => {
    const html = renderToStaticMarkup(
      <QuestionList
        eventId="event-1"
        sessionId="session-1"
        questions={[{ ...question, status: "answered", answerText: "Con métricas de adopción." }]}
        topics={[]}
      />,
    );

    expect(html).toContain("flex flex-wrap items-center gap-2");
    expect(html).toContain("break-words");
    expect(html.indexOf("Respuesta:")).toBeGreaterThan(html.indexOf("Archivar"));
  });
});
