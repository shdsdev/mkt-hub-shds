import { and, asc, eq } from "drizzle-orm";
import { authUsers } from "@/db/auth-schema-ref";
import { db } from "@/db/client";
import { eventChecklistComments, eventChecklistTasks } from "./db";
import type { ChecklistResult } from "./checklist-service";

export type ChecklistCommentRow = typeof eventChecklistComments.$inferSelect;

export type ChecklistComment = {
  id: string;
  taskId: string;
  authorId: string | null;
  authorEmail: string | null;
  body: string;
  createdAt: Date;
};

export async function listEventChecklistComments(eventId: string, organizationId: string): Promise<ChecklistComment[]> {
  return db
    .select({
      id: eventChecklistComments.id,
      taskId: eventChecklistComments.taskId,
      authorId: eventChecklistComments.authorId,
      authorEmail: authUsers.email,
      body: eventChecklistComments.body,
      createdAt: eventChecklistComments.createdAt,
    })
    .from(eventChecklistComments)
    .leftJoin(authUsers, eq(authUsers.id, eventChecklistComments.authorId))
    .where(and(eq(eventChecklistComments.eventId, eventId), eq(eventChecklistComments.organizationId, organizationId)))
    .orderBy(asc(eventChecklistComments.createdAt));
}

export async function createChecklistComment(input: {
  taskId: string;
  eventId: string;
  organizationId: string;
  authorId: string;
  body: string;
}): Promise<ChecklistResult<ChecklistCommentRow>> {
  const [task] = await db
    .select({ id: eventChecklistTasks.id })
    .from(eventChecklistTasks)
    .where(and(eq(eventChecklistTasks.id, input.taskId), eq(eventChecklistTasks.eventId, input.eventId), eq(eventChecklistTasks.organizationId, input.organizationId)))
    .limit(1);
  if (!task) return { ok: false, reason: "not_found" };

  const [comment] = await db
    .insert(eventChecklistComments)
    .values({
      organizationId: input.organizationId,
      eventId: input.eventId,
      taskId: input.taskId,
      authorId: input.authorId,
      body: input.body,
    })
    .returning();
  return comment ? { ok: true, value: comment } : { ok: false, reason: "not_found" };
}
