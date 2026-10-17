import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
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
import { createQuestionPublicToken, hashQuestionToken, normalizeQuestionText } from "./tokens";
import { QUESTION_ACCESS_CODE_ALPHABET, QUESTION_ACCESS_CODE_LENGTH, questionParticipantSchema, questionTextSchema, type QuestionParticipantInput } from "./validation";
import { calculateQuestionMetrics, type QuestionMetrics } from "./metrics";

export type QuestionSessionWithCode = { session: QuestionSessionRow; code: string; publicToken: string };
export type ParticipantWithToken = { participant: QuestionParticipantRow; token: string };

export type PublicQuestion = Pick<QuestionRow, "id" | "text" | "status" | "answerText" | "publishedAt" | "createdAt"> & {
  participantName: string;
  voteCount: number;
  hasVoted: boolean;
};

export type ModeratorQuestion = QuestionRow & {
  participantName: string;
  participantCompany: string;
  voteCount: number;
  topics: string[];
  similarQuestions: { id: string; text: string }[];
};

function createAccessCode(): string {
  const bytes = randomBytes(QUESTION_ACCESS_CODE_LENGTH);
  return Array.from(bytes, (byte) => QUESTION_ACCESS_CODE_ALPHABET[byte % QUESTION_ACCESS_CODE_ALPHABET.length]).join("");
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
  const normalizedCode = code.trim();
  const hashes = [hashQuestionToken(normalizedCode), hashQuestionToken(normalizedCode.toUpperCase())];
  const rows = await db
    .select()
    .from(questionSessions)
    .where(inArray(questionSessions.codeHash, hashes))
    .limit(1);
  const session = rows[0];
  if (!session) return undefined;
  const event = await getEvent(session.eventId, session.organizationId);
  if (!event || event.status === "closed") return undefined;
  return session;
}

export async function createOrRegenerateQuestionSession(input: {
  eventId: string;
  organizationId: string;
}): Promise<QuestionSessionWithCode> {
  const event = await getEvent(input.eventId, input.organizationId);
  if (!event) throw new Error("Event not found");

  const code = createAccessCode();
  const publicToken = createQuestionPublicToken();
  const codeHash = hashQuestionToken(publicToken);
  const accessCodeHash = hashQuestionToken(code);
  const existing = await getQuestionSession(input.eventId, input.organizationId);
  if (existing) {
    const [session] = await db
      .update(questionSessions)
      .set({ codeHash, displayCode: code, publicToken, accessCodeHash, status: "open", closedAt: null, codeCreatedAt: new Date(), updatedAt: new Date() })
      .where(eq(questionSessions.id, existing.id))
      .returning();
    return { session, code, publicToken };
  }

  const [session] = await db
    .insert(questionSessions)
    .values({ eventId: input.eventId, organizationId: input.organizationId, codeHash, displayCode: code, publicToken, accessCodeHash })
    .returning();
  return { session, code, publicToken };
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
  const [question] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, input.questionId), eq(questions.sessionId, input.sessionId)))
    .limit(1);
  if (!question || !canTransitionQuestionStatus(question.status, "answered")) throw new Error("Question cannot be answered");
  const [updated] = await db
    .update(questions)
    .set({ status: "answered", answerText, answeredBy: input.actorUserId, answeredAt: new Date(), updatedAt: new Date() })
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
  const [question] = await db
    .select({ sessionId: questions.sessionId, status: questions.status })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1);
  const [participant] = await db
    .select({ sessionId: questionParticipants.sessionId })
    .from(questionParticipants)
    .where(eq(questionParticipants.id, input.participantId))
    .limit(1);
  if (!question || !participant || question.sessionId !== participant.sessionId || !["approved", "answered"].includes(question.status)) {
    throw new Error("Participant cannot vote for this question");
  }
  await db.insert(questionVotes).values(input).onConflictDoNothing();
}

export async function toggleVoteForQuestion(input: { questionId: string; participantId: string }): Promise<{ voted: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${questions} where ${questions.id} = ${input.questionId} for update`);
    const [question] = await tx
      .select({ sessionId: questions.sessionId, status: questions.status })
      .from(questions)
      .where(eq(questions.id, input.questionId))
      .limit(1);
    const [participant] = await tx
      .select({ sessionId: questionParticipants.sessionId })
      .from(questionParticipants)
      .where(eq(questionParticipants.id, input.participantId))
      .limit(1);
    if (!question || !participant || question.sessionId !== participant.sessionId || !["approved", "answered"].includes(question.status)) {
      throw new Error("Participant cannot vote for this question");
    }

    const [vote] = await tx
      .select({ questionId: questionVotes.questionId })
      .from(questionVotes)
      .where(and(eq(questionVotes.questionId, input.questionId), eq(questionVotes.participantId, input.participantId)))
      .limit(1);
    if (vote) {
      await tx
        .delete(questionVotes)
        .where(and(eq(questionVotes.questionId, input.questionId), eq(questionVotes.participantId, input.participantId)));
      return { voted: false };
    }

    await tx.insert(questionVotes).values(input);
    return { voted: true };
  });
}

export async function listPublicQuestions(sessionId: string, participantId: string): Promise<PublicQuestion[]> {
  const rows = await db
    .select({
      question: questions,
      participantName: questionParticipants.fullName,
      voteCount: count(questionVotes.questionId),
      hasVoted: sql<boolean>`coalesce(bool_or(${questionVotes.participantId} = ${participantId}), false)`,
    })
    .from(questions)
    .innerJoin(questionParticipants, eq(questionParticipants.id, questions.participantId))
    .leftJoin(questionVotes, eq(questionVotes.questionId, questions.id))
    .where(and(eq(questions.sessionId, sessionId), inArray(questions.status, ["approved", "answered"])))
    .groupBy(questions.id, questionParticipants.id)
    .orderBy(desc(count(questionVotes.questionId)), asc(questions.createdAt));

  return rows.map(({ question, participantName, voteCount, hasVoted }) => ({
    ...question,
    participantName,
    answerText: question.publishedAt ? question.answerText : null,
    voteCount: Number(voteCount),
    hasVoted: Boolean(hasVoted),
  }));
}

export async function listModeratorQuestions(sessionId: string, filters?: { status?: QuestionStatus; search?: string }): Promise<ModeratorQuestion[]> {
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
    .where(and(
      eq(questions.sessionId, sessionId),
      filters?.status ? eq(questions.status, filters.status) : undefined,
      filters?.search ? ilike(questions.text, `%${filters.search}%`) : undefined,
    ))
    .groupBy(questions.id, questionParticipants.id)
    .orderBy(desc(questions.createdAt));

  const questionIds = rows.map(({ question }) => question.id);
  const topicRows = questionIds.length === 0
    ? []
    : await db
      .select({ questionId: questionQuestionTopics.questionId, name: questionTopics.name })
      .from(questionQuestionTopics)
      .innerJoin(questionTopics, eq(questionTopics.id, questionQuestionTopics.topicId))
      .where(inArray(questionQuestionTopics.questionId, questionIds));
  const topicsByQuestion = new Map<string, string[]>();
  for (const topic of topicRows) topicsByQuestion.set(topic.questionId, [...(topicsByQuestion.get(topic.questionId) ?? []), topic.name]);
  const sessionQuestions = await db
    .select({ id: questions.id, text: questions.text, normalizedText: questions.normalizedText })
    .from(questions)
    .where(eq(questions.sessionId, sessionId));
  const similarByQuestion = new Map<string, { id: string; text: string }[]>();
  for (const question of sessionQuestions) {
    const similar = sessionQuestions.filter((candidate) => candidate.id !== question.id && candidate.normalizedText === question.normalizedText).map(({ id, text }) => ({ id, text }));
    if (similar.length > 0) similarByQuestion.set(question.id, similar);
  }

  return rows.map(({ question, participantName, participantCompany, voteCount }) => ({
    ...question,
    participantName,
    participantCompany,
    voteCount: Number(voteCount),
    topics: topicsByQuestion.get(question.id) ?? [],
    similarQuestions: similarByQuestion.get(question.id) ?? [],
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

export async function assignQuestionTopic(input: { sessionId: string; questionId: string; topicId: string }): Promise<void> {
  const [question] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.id, input.questionId), eq(questions.sessionId, input.sessionId))).limit(1);
  const [topic] = await db.select({ id: questionTopics.id }).from(questionTopics).where(and(eq(questionTopics.id, input.topicId), eq(questionTopics.sessionId, input.sessionId))).limit(1);
  if (!question || !topic) throw new Error("Question topic is outside the session");
  await db.insert(questionQuestionTopics).values(input).onConflictDoNothing();
}

export async function recordQuestionDuplicate(input: { sessionId: string; sourceQuestionId: string; targetQuestionId: string; createdBy: string }): Promise<void> {
  if (input.sourceQuestionId === input.targetQuestionId) throw new Error("A question cannot duplicate itself");
  const scopedQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.sessionId, input.sessionId), inArray(questions.id, [input.sourceQuestionId, input.targetQuestionId])));
  if (scopedQuestions.length !== 2) throw new Error("Duplicate questions must share a session");
  await db.insert(questionDuplicates).values({ sourceQuestionId: input.sourceQuestionId, targetQuestionId: input.targetQuestionId, createdBy: input.createdBy }).onConflictDoNothing();
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
