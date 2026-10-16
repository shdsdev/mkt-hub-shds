import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db as applicationDb } from "@/db/client";
import { events } from "@/modules/events/db";
import { organizations } from "@/modules/users/db";
import { questionParticipants, questionSessions, questionVotes, questions } from "./db";
import { listPublicQuestions, toggleVoteForQuestion } from "./service";

vi.mock("@/modules/events", () => ({ getEvent: vi.fn() }));

async function cleanup(ids: { organizationId: string; eventId: string; sessionId: string; questionId: string; participantIds: string[] }) {
  await applicationDb.delete(questionVotes).where(eq(questionVotes.questionId, ids.questionId));
  await applicationDb.delete(questions).where(eq(questions.id, ids.questionId));
  await applicationDb.delete(questionParticipants).where(inArray(questionParticipants.id, ids.participantIds));
  await applicationDb.delete(questionSessions).where(eq(questionSessions.id, ids.sessionId));
  await applicationDb.delete(events).where(eq(events.id, ids.eventId));
  await applicationDb.delete(organizations).where(eq(organizations.id, ids.organizationId));
}

describe("questions service likes", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for database tests");
  });

  it("toggles a vote atomically and isolates participants", async () => {
    const ids = {
      organizationId: randomUUID(),
      eventId: randomUUID(),
      sessionId: randomUUID(),
      questionId: randomUUID(),
      participantAId: randomUUID(),
      participantBId: randomUUID(),
    };

    await applicationDb.insert(organizations).values({ id: ids.organizationId, name: `Questions test ${ids.organizationId}` });
    await applicationDb.insert(events).values({
        id: ids.eventId,
        organizationId: ids.organizationId,
        name: "Questions test event",
        slug: `questions-test-${ids.eventId}`,
        startsAt: new Date("2030-01-01T00:00:00Z"),
    });
    await applicationDb.execute(sql`
      insert into question_sessions (id, organization_id, event_id, code_hash)
      values (${ids.sessionId}, ${ids.organizationId}, ${ids.eventId}, ${`questions-test-${ids.sessionId}`})
    `);
    await applicationDb.insert(questionParticipants).values([
        {
          id: ids.participantAId,
          sessionId: ids.sessionId,
          fullName: "Participant A",
          company: "Test",
          tokenHash: `token-a-${ids.sessionId}`,
          consentAcceptedAt: new Date(),
        },
        {
          id: ids.participantBId,
          sessionId: ids.sessionId,
          fullName: "Participant B",
          company: "Test",
          tokenHash: `token-b-${ids.sessionId}`,
          consentAcceptedAt: new Date(),
        },
    ]);
    await applicationDb.insert(questions).values({
        id: ids.questionId,
        sessionId: ids.sessionId,
        participantId: ids.participantAId,
        text: "How does this work?",
        normalizedText: "how does this work",
        status: "approved",
    });

    const first = await toggleVoteForQuestion({ questionId: ids.questionId, participantId: ids.participantAId });
    expect(first).toEqual({ voted: true });
    expect(await listPublicQuestions(ids.sessionId, ids.participantAId)).toEqual([
      expect.objectContaining({ id: ids.questionId, voteCount: 1, hasVoted: true }),
    ]);
    expect(await listPublicQuestions(ids.sessionId, ids.participantBId)).toEqual([
      expect.objectContaining({ id: ids.questionId, voteCount: 1, hasVoted: false }),
    ]);

    const second = await toggleVoteForQuestion({ questionId: ids.questionId, participantId: ids.participantAId });
    expect(second).toEqual({ voted: false });
    expect(await listPublicQuestions(ids.sessionId, ids.participantAId)).toEqual([
      expect.objectContaining({ id: ids.questionId, voteCount: 0, hasVoted: false }),
    ]);
    await cleanup({ ...ids, participantIds: [ids.participantAId, ids.participantBId] });
  });

  it("serializes concurrent toggles and returns each transaction's final state", async () => {
    const ids = {
      organizationId: randomUUID(),
      eventId: randomUUID(),
      sessionId: randomUUID(),
      questionId: randomUUID(),
      participantId: randomUUID(),
    };

    await applicationDb.insert(organizations).values({ id: ids.organizationId, name: `Concurrency test ${ids.organizationId}` });
    await applicationDb.insert(events).values({
        id: ids.eventId,
        organizationId: ids.organizationId,
        name: "Concurrency test event",
        slug: `concurrency-test-${ids.eventId}`,
        startsAt: new Date("2030-01-01T00:00:00Z"),
    });
    await applicationDb.execute(sql`
      insert into question_sessions (id, organization_id, event_id, code_hash)
      values (${ids.sessionId}, ${ids.organizationId}, ${ids.eventId}, ${`concurrency-test-${ids.sessionId}`})
    `);
    await applicationDb.insert(questionParticipants).values({ id: ids.participantId, sessionId: ids.sessionId, fullName: "Participant", company: "Test", tokenHash: `token-${ids.sessionId}`, consentAcceptedAt: new Date() });
    await applicationDb.insert(questions).values({ id: ids.questionId, sessionId: ids.sessionId, participantId: ids.participantId, text: "Concurrent?", normalizedText: "concurrent", status: "approved" });

    const results = await Promise.all([
      toggleVoteForQuestion({ questionId: ids.questionId, participantId: ids.participantId }),
      toggleVoteForQuestion({ questionId: ids.questionId, participantId: ids.participantId }),
    ]);
    expect(results.map((result) => result.voted).sort()).toEqual([false, true]);
    expect(await applicationDb.select().from(questionVotes).where(eq(questionVotes.questionId, ids.questionId))).toHaveLength(0);
    await cleanup({ ...ids, participantIds: [ids.participantId] });
  });
});
