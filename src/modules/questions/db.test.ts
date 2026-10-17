import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  questionSessionStatus,
  questionStatus,
  questionSessions,
  questions,
  questionVotes,
} from "./db";

describe("questions schema", () => {
  it("defines the session and question lifecycle enums", () => {
    expect(questionSessionStatus.enumValues).toEqual(["open", "closed"]);
    expect(questionStatus.enumValues).toEqual(["pending", "approved", "rejected", "answered", "archived"]);
  });

  it("requires organization and event scope for sessions and questions", () => {
    expect(questionSessions.organizationId.notNull).toBe(true);
    expect(questionSessions.eventId.notNull).toBe(true);
    expect(questions.sessionId.notNull).toBe(true);
    expect(questions.participantId.notNull).toBe(true);
    expect(questions.text.notNull).toBe(true);
  });

  it("stores a display code separately from the verification hash", () => {
    const columns = getTableConfig(questionSessions).columns;
    expect(columns.some((column) => column.name === "display_code")).toBe(true);
    expect(columns.some((column) => column.name === "code_hash")).toBe(true);
  });

  it("prevents duplicate sessions and votes", () => {
    const sessionIndexes = getTableConfig(questionSessions).indexes;
    const votePrimaryKeys = getTableConfig(questionVotes).primaryKeys;
    expect(sessionIndexes.find((index) => index.config.name === "question_sessions_event_unique")?.config.unique).toBe(true);
    expect(votePrimaryKeys.some((key) => key.name === "question_votes_question_participant_pk")).toBe(true);
  });
});
