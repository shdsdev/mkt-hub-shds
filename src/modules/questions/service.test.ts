import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, insertMock, selectMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  insertMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    delete: deleteMock,
    insert: insertMock,
    select: selectMock,
  },
}));

vi.mock("@/modules/events", () => ({
  getEvent: vi.fn(),
}));

import { listPublicQuestions, toggleVoteForQuestion } from "./service";

function selectChain<T>(rows: T[]) {
  const chain = {
    from: vi.fn(),
    groupBy: vi.fn(),
    leftJoin: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  chain.from.mockReturnValue(chain);
  chain.groupBy.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function insertChain() {
  const chain = { values: vi.fn(), onConflictDoNothing: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoNothing.mockResolvedValue(undefined);
  return chain;
}

function deleteChain() {
  const chain = { where: vi.fn() };
  chain.where.mockResolvedValue(undefined);
  return chain;
}

const approvedQuestion = { sessionId: "session-1", status: "approved" as const };
const participant = { sessionId: "session-1" };

function prepareToggle({
  vote = [],
  question = approvedQuestion,
  participantRow = participant,
}: {
  vote?: { questionId: string; participantId: string }[];
  question?: typeof approvedQuestion;
  participantRow?: typeof participant;
} = {}) {
  selectMock
    .mockReturnValueOnce(selectChain([question]))
    .mockReturnValueOnce(selectChain([participantRow]))
    .mockReturnValueOnce(selectChain(vote));
}

describe("questions service likes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("adds a participant vote on the first toggle", async () => {
    prepareToggle();
    const chain = insertChain();
    insertMock.mockReturnValue(chain);

    await expect(toggleVoteForQuestion({ questionId: "question-1", participantId: "participant-1" })).resolves.toEqual({ voted: true });

    expect(chain.values as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({ questionId: "question-1", participantId: "participant-1" });
    expect(chain.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("removes the participant vote on the second toggle", async () => {
    prepareToggle({ vote: [{ questionId: "question-1", participantId: "participant-1" }] });
    const chain = deleteChain();
    deleteMock.mockReturnValue(chain);

    await expect(toggleVoteForQuestion({ questionId: "question-1", participantId: "participant-1" })).resolves.toEqual({ voted: false });

    expect(chain.where).toHaveBeenCalledOnce();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("protects the composite vote key when adding a vote", async () => {
    prepareToggle();
    const chain = insertChain();
    insertMock.mockReturnValue(chain);

    await toggleVoteForQuestion({ questionId: "question-1", participantId: "participant-1" });

    expect(chain.onConflictDoNothing).toHaveBeenCalledWith();
  });

  it("isolates votes between participants", async () => {
    prepareToggle();
    const chain = insertChain();
    insertMock.mockReturnValue(chain);

    await expect(toggleVoteForQuestion({ questionId: "question-1", participantId: "participant-1" })).resolves.toEqual({ voted: true });
    expect(chain.values as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({ questionId: "question-1", participantId: "participant-1" });
  });

  it("rejects votes across question sessions", async () => {
    prepareToggle({ participantRow: { sessionId: "session-2" } });

    await expect(toggleVoteForQuestion({ questionId: "question-1", participantId: "participant-1" })).rejects.toThrow(
      "Participant cannot vote for this question",
    );
    expect(insertMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns total votes and the current participant state", async () => {
    const chain = selectChain([
      {
        question: { id: "question-1", text: "Question", status: "approved", answerText: null, publishedAt: null, createdAt: new Date() },
        voteCount: 2,
        hasVoted: true,
      },
    ]);
    selectMock.mockReturnValue(chain);

    await expect(listPublicQuestions("session-1", "participant-1")).resolves.toEqual([
      expect.objectContaining({ id: "question-1", voteCount: 2, hasVoted: true }),
    ]);
  });
});
