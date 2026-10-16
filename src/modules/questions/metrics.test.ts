import { describe, expect, it } from "vitest";
import { calculateQuestionMetrics } from "./metrics";

describe("calculateQuestionMetrics", () => {
  it("calculates participation and response rate from event records", () => {
    expect(
      calculateQuestionMetrics({
        participantIds: ["a", "a", "b", "c"],
        questionAuthors: ["a", "b", "b"],
        receivedQuestions: 3,
        answeredQuestions: 2,
        votes: 4,
      }),
    ).toEqual({
      uniqueParticipants: 3,
      participantsWhoAsked: 2,
      questionsPerParticipant: 1,
      receivedQuestions: 3,
      answeredQuestions: 2,
      responseRate: 2 / 3,
      votes: 4,
    });
  });

  it("returns a zero response rate when there are no questions", () => {
    expect(
      calculateQuestionMetrics({
        participantIds: [],
        questionAuthors: [],
        receivedQuestions: 0,
        answeredQuestions: 0,
        votes: 0,
      }).responseRate,
    ).toBe(0);
  });
});
