"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent } from "@/modules/events";
import { isActive } from "@/modules/users";
import { recordAudit } from "@/modules/audit";
import {
  answerQuestion,
  assignQuestionTopic,
  closeQuestionSession,
  createOrRegenerateQuestionSession,
  createQuestionTopic,
  getQuestionSession,
  publishQuestionAnswer,
  recordQuestionDuplicate,
  transitionQuestionStatus,
} from "@/modules/questions";

export type QuestionActionState = {
  error?: string;
  success?: string;
  code?: string;
  publicUrl?: string;
};

const eventIdSchema = z.string().uuid();
const questionFields = z.object({ eventId: eventIdSchema, sessionId: z.string().uuid(), questionId: z.string().uuid() });

async function requireQuestionsUser(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return undefined;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "questions" }))) return undefined;
  return user;
}

async function requireQuestionSession(eventId: string, organizationId: string, sessionId: string) {
  const session = await getQuestionSession(eventId, organizationId);
  return session?.id === sessionId ? session : undefined;
}

function route(eventId: string) {
  return `/events/${eventId}/questions`;
}

export async function createQuestionSessionAction(
  _previous: QuestionActionState,
  formData: FormData,
): Promise<QuestionActionState> {
  const eventId = eventIdSchema.safeParse(formData.get("eventId"));
  if (!eventId.success) return { error: "Evento inválido." };
  const user = await requireQuestionsUser(eventId.data);
  if (!user) return { error: "No tienes permiso para administrar preguntas." };

  try {
    const { session, code } = await createOrRegenerateQuestionSession({ eventId: eventId.data, organizationId: user.profile.organizationId });
    await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "question_regenerate_code", resourceType: "question_session", resourceId: session.id, after: { codeIssued: true } });
    revalidatePath(route(eventId.data));
    const appOrigin = env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/+$/, "");
    return {
      success: "Código generado. El código anterior dejó de funcionar.",
      code,
      publicUrl: `${appOrigin}/questions/${code}`,
    };
  } catch {
    return { error: "No se pudo generar el código de preguntas." };
  }
}

export async function closeQuestionSessionAction(formData: FormData): Promise<void> {
  const eventId = eventIdSchema.safeParse(formData.get("eventId"));
  if (!eventId.success) return;
  const user = await requireQuestionsUser(eventId.data);
  if (!user) return;

  const session = await closeQuestionSession({ eventId: eventId.data, organizationId: user.profile.organizationId });
  if (session) await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "question_close_session", resourceType: "question_session", resourceId: session.id });
  revalidatePath(route(eventId.data));
}

export async function moderateQuestionAction(formData: FormData): Promise<void> {
  const parsed = questionFields.extend({ status: z.enum(["approved", "rejected", "archived"]) }).safeParse({
    eventId: formData.get("eventId"),
    sessionId: formData.get("sessionId"),
    questionId: formData.get("questionId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;
  const user = await requireQuestionsUser(parsed.data.eventId);
  if (!user) return;
  if (!(await requireQuestionSession(parsed.data.eventId, user.profile.organizationId, parsed.data.sessionId))) return;

  try {
    await transitionQuestionStatus({ questionId: parsed.data.questionId, sessionId: parsed.data.sessionId, status: parsed.data.status, actorUserId: user.id });
    const action = parsed.data.status === "approved" ? "question_approve" : parsed.data.status === "rejected" ? "question_reject" : "question_archive";
    await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action, resourceType: "question", resourceId: parsed.data.questionId, after: { status: parsed.data.status } });
    revalidatePath(route(parsed.data.eventId));
    return;
  } catch {
    return;
  }
}

export async function answerQuestionAction(formData: FormData): Promise<void> {
  const parsed = questionFields.extend({ answerText: z.string().trim().min(1).max(500) }).safeParse({
    eventId: formData.get("eventId"),
    sessionId: formData.get("sessionId"),
    questionId: formData.get("questionId"),
    answerText: formData.get("answerText"),
  });
  if (!parsed.success) return;
  const user = await requireQuestionsUser(parsed.data.eventId);
  if (!user) return;
  if (!(await requireQuestionSession(parsed.data.eventId, user.profile.organizationId, parsed.data.sessionId))) return;

  try {
    await answerQuestion({ questionId: parsed.data.questionId, sessionId: parsed.data.sessionId, answerText: parsed.data.answerText, actorUserId: user.id });
    await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "question_answer", resourceType: "question", resourceId: parsed.data.questionId, after: { answered: true } });
    revalidatePath(route(parsed.data.eventId));
    return;
  } catch {
    return;
  }
}

export async function publishQuestionAnswerAction(formData: FormData): Promise<void> {
  const parsed = questionFields.safeParse({
    eventId: formData.get("eventId"),
    sessionId: formData.get("sessionId"),
    questionId: formData.get("questionId"),
  });
  if (!parsed.success) return;
  const user = await requireQuestionsUser(parsed.data.eventId);
  if (!user) return;
  if (!(await requireQuestionSession(parsed.data.eventId, user.profile.organizationId, parsed.data.sessionId))) return;

  try {
    await publishQuestionAnswer({ questionId: parsed.data.questionId, sessionId: parsed.data.sessionId, actorUserId: user.id });
    await recordAudit({ organizationId: user.profile.organizationId, userId: user.id, action: "question_publish", resourceType: "question", resourceId: parsed.data.questionId, after: { published: true } });
    revalidatePath(route(parsed.data.eventId));
    return;
  } catch {
    return;
  }
}

export async function createQuestionTopicAction(formData: FormData): Promise<void> {
  const parsed = z.object({ eventId: eventIdSchema, sessionId: z.string().uuid(), name: z.string().trim().min(1).max(100) }).safeParse({
    eventId: formData.get("eventId"), sessionId: formData.get("sessionId"), name: formData.get("name"),
  });
  if (!parsed.success) return;
  const user = await requireQuestionsUser(parsed.data.eventId);
  if (!user || !(await requireQuestionSession(parsed.data.eventId, user.profile.organizationId, parsed.data.sessionId))) return;
  await createQuestionTopic({ sessionId: parsed.data.sessionId, name: parsed.data.name });
  revalidatePath(route(parsed.data.eventId));
}

export async function assignQuestionTopicAction(formData: FormData): Promise<void> {
  const parsed = z.object({ eventId: eventIdSchema, sessionId: z.string().uuid(), questionId: z.string().uuid(), topicId: z.string().uuid() }).safeParse({
    eventId: formData.get("eventId"), sessionId: formData.get("sessionId"), questionId: formData.get("questionId"), topicId: formData.get("topicId"),
  });
  if (!parsed.success) return;
  const user = await requireQuestionsUser(parsed.data.eventId);
  if (!user || !(await requireQuestionSession(parsed.data.eventId, user.profile.organizationId, parsed.data.sessionId))) return;
  await assignQuestionTopic({ ...parsed.data, sessionId: parsed.data.sessionId });
  revalidatePath(route(parsed.data.eventId));
}

export async function recordQuestionDuplicateAction(formData: FormData): Promise<void> {
  const parsed = z.object({ eventId: eventIdSchema, sessionId: z.string().uuid(), sourceQuestionId: z.string().uuid(), targetQuestionId: z.string().uuid() }).safeParse({
    eventId: formData.get("eventId"), sessionId: formData.get("sessionId"), sourceQuestionId: formData.get("sourceQuestionId"), targetQuestionId: formData.get("targetQuestionId"),
  });
  if (!parsed.success) return;
  const user = await requireQuestionsUser(parsed.data.eventId);
  if (!user || !(await requireQuestionSession(parsed.data.eventId, user.profile.organizationId, parsed.data.sessionId))) return;
  await recordQuestionDuplicate({ ...parsed.data, createdBy: user.id });
  revalidatePath(route(parsed.data.eventId));
}
