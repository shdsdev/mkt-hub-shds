import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "@/db/auth-schema-ref";
import { events } from "@/modules/events/db";
import { organizations } from "@/modules/users/db";

export const questionSessionStatus = pgEnum("question_session_status", ["open", "closed"]);
export const questionStatus = pgEnum("question_status", [
  "pending",
  "approved",
  "rejected",
  "answered",
  "archived",
]);

export const questionSessions = pgTable(
  "question_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    displayCode: text("display_code"),
    publicToken: text("public_token"),
    accessCodeHash: text("access_code_hash"),
    status: questionSessionStatus("status").notNull().default("open"),
    codeCreatedAt: timestamp("code_created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("question_sessions_event_unique").on(table.eventId),
    uniqueIndex("question_sessions_code_hash_unique").on(table.codeHash),
    index("question_sessions_organization_idx").on(table.organizationId),
  ],
);

export const questionParticipants = pgTable(
  "question_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => questionSessions.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    company: text("company").notNull(),
    tokenHash: text("token_hash").notNull(),
    consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("question_participants_session_token_unique").on(table.sessionId, table.tokenHash),
    index("question_participants_session_idx").on(table.sessionId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => questionSessions.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => questionParticipants.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    normalizedText: text("normalized_text").notNull(),
    status: questionStatus("status").notNull().default("pending"),
    answerText: text("answer_text"),
    approvedBy: uuid("approved_by").references(() => authUsers.id, { onDelete: "cascade" }),
    answeredBy: uuid("answered_by").references(() => authUsers.id, { onDelete: "cascade" }),
    publishedBy: uuid("published_by").references(() => authUsers.id, { onDelete: "cascade" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("questions_session_status_idx").on(table.sessionId, table.status),
    index("questions_session_normalized_text_idx").on(table.sessionId, table.normalizedText),
  ],
);

export const questionVotes = pgTable(
  "question_votes",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => questionParticipants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.questionId, table.participantId], name: "question_votes_question_participant_pk" }),
    index("question_votes_question_idx").on(table.questionId),
  ],
);

export const questionTopics = pgTable(
  "question_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => questionSessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("question_topics_session_name_unique").on(table.sessionId, sql`lower(${table.name})`)],
);

export const questionQuestionTopics = pgTable(
  "question_question_topics",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => questionTopics.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.topicId], name: "question_question_topics_pk" })],
);

export const questionDuplicates = pgTable(
  "question_duplicates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceQuestionId: uuid("source_question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    targetQuestionId: uuid("target_question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("question_duplicates_pair_unique").on(table.sourceQuestionId, table.targetQuestionId)],
);

export type QuestionSessionRow = typeof questionSessions.$inferSelect;
export type QuestionParticipantRow = typeof questionParticipants.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type QuestionTopicRow = typeof questionTopics.$inferSelect;

export const questionsTables = {
  questionSessionStatus,
  questionStatus,
  questionSessions,
  questionParticipants,
  questions,
  questionVotes,
  questionTopics,
  questionQuestionTopics,
  questionDuplicates,
} as const;
