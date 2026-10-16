import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { getEvent } from "@/modules/events";
import {
  questionParticipants,
  questionDuplicates,
  questionQuestionTopics,
  questionSessions,
  questionTopics,
  questions,
  questionVotes,
  type QuestionParticipantRow,
  type QuestionRow,
  type QuestionSessionRow,
} from "./db";
import { canTransitionQuestionStatus, type QuestionStatus } from "./state";
import { hashQuestionToken, normalizeQuestionText } from "./tokens";
import { questionParticipantSchema, questionTextSchema, type QuestionParticipantInput } from "./validation";
import { calculateQuestionMetrics, type QuestionMetrics } from "./metrics";

export type QuestionSessionWithCode = { session: QuestionSessionRow; code: string };
export type ParticipantWithToken = { participant: QuestionParticipantRow; token: string };

export type PublicQuestion = Pick<QuestionRow, "id" | "text" | "status" | "answerText" | "publishedAt" | "createdAt"> & {
  voteCount: number;
};

export type ModeratorQuestion = QuestionRow & {
  participantName: string;
  participantCompany: string;
  voteCount: number;
};

function createAccessCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

function createParticipantToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function getQuestionSession(eventId: string, organizationId: string): Promise<QuestionSessionRow | undefined> {
  const rows = await db
    .select()
    .from(questionSessions)
    .where(and(eq(questionSessions.eventId, eventId), eq(questionSessions.organizationId, organizationId)))
    .limit(1);
  return rows[0];
}

export async function getQuestionSessionByCode(code: string): Promise<QuestionSessionRow | undefined> {
  const rows = await db
    .select()
    .from(questionSessions)
    .where(eq(questionSessions.codeHash, hashQuestionToken(code.trim().toUpperCase())))
    .limit(1);
  return rows[0];
}

export async function createOrRegenerateQuestionSession(input: {
  eventId: string;
  organizationId: string;
}): Promise<QuestionSessionWithCode> {
  const event = await getEvent(input.eventId, input.organizationId);
  if (!event) throw new Error("Event not found");

  const code = createAccessCode();
  const codeHash = hashQuestionToken(code);
  const existing = await getQuestionSession(input.eventId, input.organizationId);
  if (existing) {
    const [session] = await db
      .update(questionSessions)
      .set({ codeHash, status: "open", closedAt: null, codeCreatedAt: new Date(), updatedAt: new Date() })
      .where(eq(questionSessions.id, existing.id))
      .returning();
    return { session, code };
  }

  const [session] = await db
    .insert(questionSessions)
    .values({ eventId: input.eventId, organizationId: input.organizationId, codeHash })
    .returning();
  return { session, code };
}

export async function closeQuestionSession(input: {
  eventId: string;
  organizationId: string;
}): Promise<QuestionSessionRow | undefined> {
  const [session] = await db
    .update(questionSessions)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(questionSessions.eventId, input.eventId), eq(questionSessions.organizationId, input.organizationId)))
    .returning();
  return session;
}

export async function getParticipantByToken(input: {
  sessionId: string;
  token: string;
}): Promise<QuestionParticipantRow | undefined> {
  const [participant] = await db
    .select()
    .from(questionParticipants)
    .where(
      and(
        eq(questionParticipants.sessionId, input.sessionId),
        eq(questionParticipants.tokenHash, hashQuestionToken(input.token)),
      ),
    )
    .limit(1);
  if (!participant) return undefined;

  const [updated] = await db
    .update(questionParticipants)
    .set({ lastSeenAt: new Date() })
    .where(eq(questionParticipants.id, participant.id))
    .returning();
  return updated;
}

export async function registerQuestionParticipant(input: QuestionParticipantInput & { sessionId: string }): Promise<ParticipantWithToken> {
  const parsed = questionParticipantSchema.parse(input);
  const token = createParticipantToken();
  const [participant] = await db
    .insert(questionParticipants)
    .values({
      sessionId: input.sessionId,
      fullName: parsed.fullName,
      company: parsed.company,
      tokenHash: hashQuestionToken(token),
      consentAcceptedAt: new Date(),
    })
    .returning();
  return { participant, token };
}

export async function createQuestion(input: {
  sessionId: string;
  participantId: string;
  text: string;
}): Promise<QuestionRow> {
  const text = questionTextSchema.parse(input.text);
  const [session] = await db
    .select({ id: questionSessions.id, status: questionSessions.status })
    .from(questionSessions)
    .where(eq(questionSessions.id, input.sessionId))
    .limit(1);
  if (!session || session.status !== "open") throw new Error("Question session is closed");

  const [participant] = await db
    .select({ id: questionParticipants.id })
    .from(questionParticipants)
    .where(and(eq(questionParticipants.id, input.participantId), eq(questionParticipants.sessionId, input.sessionId)))
    .limit(1);
  if (!participant) throw new Error("Participant not found");

  const [question] = await db
    .insert(questions)
    .values({ sessionId: input.sessionId, participantId: input.participantId, text, normalizedText: normalizeQuestionText(text) })
    .returning();
  return question;
}

export async function transitionQuestionStatus(input: {
  questionId: string;
  sessionId: string;
  status: QuestionStatus;
  actorUserId?: string;
}): Promise<QuestionRow> {
  const [question] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, input.questionId), eq(questions.sessionId, input.sessionId)))
    .limit(1);
  if (!question) throw new Error("Question not found");
  if (!canTransitionQuestionStatus(question.status, input.status)) {
    throw new Error(`Invalid question transition: ${question.status} -> ${input.status}`);
  }

  const now = new Date();
  const [updated] = await db
    .update(questions)
    .set({
      status: input.status,
      approvedBy: input.status === "approved" ? input.actorUserId : question.approvedBy,
      approvedAt: input.status === "approved" ? now : question.approvedAt,
      archivedAt: input.status === "archived" ? now : input.status === "approved" ? null : question.archivedAt,
      updatedAt: now,
    })
    .where(eq(questions.id, question.id))
    .returning();
  return updated;
}

export async function answerQuestion(input: {
  questionId: string;
  sessionId: string;
  answerText: string;
  actorUserId: string;
}): Promise<QuestionRow> {
  const answerText = questionTextSchema.parse(input.answerText);
  const question = await transitionQuestionStatus({
    questionId: input.questionId,
    sessionId: input.sessionId,
    status: "answered",
    actorUserId: input.actorUserId,
  });
  const [updated] = await db
    .update(questions)
    .set({ answerText, answeredBy: input.actorUserId, answeredAt: new Date(), updatedAt: new Date() })
    .where(eq(questions.id, question.id))
    .returning();
  return updated;
}

export async function publishQuestionAnswer(input: {
  questionId: string;
  sessionId: string;
  actorUserId: string;
}): Promise<QuestionRow> {
  const [question] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, input.questionId), eq(questions.sessionId, input.sessionId)))
    .limit(1);
  if (!question || question.status !== "answered" || !question.answerText) throw new Error("Question has no answer to publish");

  const [updated] = await db
    .update(questions)
    .set({ publishedBy: input.actorUserId, publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(questions.id, question.id))
    .returning();
  return updated;
}

export async function voteForQuestion(input: { questionId: string; participantId: string }): Promise<void> {
  await db.insert(questionVotes).values(input).onConflictDoNothing();
}

export async function listPublicQuestions(sessionId: string): Promise<PublicQuestion[]> {
  const rows = await db
    .select({
      question: questions,
      voteCount: count(questionVotes.questionId),
    })
    .from(questions)
    .leftJoin(questionVotes, eq(questionVotes.questionId, questions.id))
    .where(and(eq(questions.sessionId, sessionId), inArray(questions.status, ["approved", "answered"])))
    .groupBy(questions.id)
    .orderBy(desc(count(questionVotes.questionId)), asc(questions.createdAt));

  return rows.map(({ question, voteCount }) => ({
    ...question,
    answerText: question.publishedAt ? question.answerText : null,
    voteCount: Number(voteCount),
  }));
}

export async function listModeratorQuestions(sessionId: string): Promise<ModeratorQuestion[]> {
  const rows = await db
    .select({
      question: questions,
      participantName: questionParticipants.fullName,
      participantCompany: questionParticipants.company,
      voteCount: count(questionVotes.questionId),
    })
    .from(questions)
    .innerJoin(questionParticipants, eq(questionParticipants.id, questions.participantId))
    .leftJoin(questionVotes, eq(questionVotes.questionId, questions.id))
    .where(eq(questions.sessionId, sessionId))
    .groupBy(questions.id, questionParticipants.id)
    .orderBy(desc(questions.createdAt));

  return rows.map(({ question, participantName, participantCompany, voteCount }) => ({
    ...question,
    participantName,
    participantCompany,
    voteCount: Number(voteCount),
  }));
}

export async function listSimilarQuestions(input: {
  sessionId: string;
  text: string;
  excludeQuestionId?: string;
}): Promise<QuestionRow[]> {
  const normalizedText = normalizeQuestionText(input.text);
  return db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.sessionId, input.sessionId),
        eq(questions.normalizedText, normalizedText),
        input.excludeQuestionId ? ne(questions.id, input.excludeQuestionId) : undefined,
      ),
    )
    .orderBy(desc(questions.createdAt))
    .limit(5);
}

export async function createQuestionTopic(input: { sessionId: string; name: string }): Promise<typeof questionTopics.$inferSelect> {
  const name = input.name.trim();
  if (!name || name.length > 100) throw new Error("Invalid question topic");
  const [topic] = await db.insert(questionTopics).values({ sessionId: input.sessionId, name }).returning();
  return topic;
}

export async function listQuestionTopics(sessionId: string) {
  return db.select().from(questionTopics).where(eq(questionTopics.sessionId, sessionId)).orderBy(asc(questionTopics.name));
}

export async function assignQuestionTopic(input: { questionId: string; topicId: string }): Promise<void> {
  await db.insert(questionQuestionTopics).values(input).onConflictDoNothing();
}

export async function recordQuestionDuplicate(input: { sourceQuestionId: string; targetQuestionId: string; createdBy: string }): Promise<void> {
  if (input.sourceQuestionId === input.targetQuestionId) throw new Error("A question cannot duplicate itself");
  await db.insert(questionDuplicates).values(input).onConflictDoNothing();
}

export async function getQuestionMetrics(sessionId: string): Promise<QuestionMetrics> {
  const [participants, authors, received, answered, votes] = await Promise.all([
    db.select({ id: questionParticipants.id }).from(questionParticipants).where(eq(questionParticipants.sessionId, sessionId)),
    db.select({ participantId: questions.participantId }).from(questions).where(eq(questions.sessionId, sessionId)),
    db.select({ total: count() }).from(questions).where(eq(questions.sessionId, sessionId)),
    db.select({ total: count() }).from(questions).where(and(eq(questions.sessionId, sessionId), eq(questions.status, "answered"))),
    db.select({ total: count() }).from(questionVotes).innerJoin(questions, eq(questions.id, questionVotes.questionId)).where(eq(questions.sessionId, sessionId)),
  ]);

  return calculateQuestionMetrics({
    participantIds: participants.map(({ id }) => id),
    questionAuthors: authors.map(({ participantId }) => participantId),
    receivedQuestions: Number(received[0]?.total ?? 0),
    answeredQuestions: Number(answered[0]?.total ?? 0),
    votes: Number(votes[0]?.total ?? 0),
  });
}
