"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent } from "@/modules/events";
import { isActive } from "@/modules/users";
import {
  answerQuestion,
  closeQuestionSession,
  createOrRegenerateQuestionSession,
  publishQuestionAnswer,
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
    const { code } = await createOrRegenerateQuestionSession({ eventId: eventId.data, organizationId: user.profile.organizationId });
    revalidatePath(route(eventId.data));
    return {
      success: "Código generado. El código anterior dejó de funcionar.",
      code,
      publicUrl: `${env.NEXT_PUBLIC_APP_ORIGIN}/questions/${code}`,
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

  await closeQuestionSession({ eventId: eventId.data, organizationId: user.profile.organizationId });
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

  try {
    await transitionQuestionStatus({ questionId: parsed.data.questionId, sessionId: parsed.data.sessionId, status: parsed.data.status, actorUserId: user.id });
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

  try {
    await answerQuestion({ questionId: parsed.data.questionId, sessionId: parsed.data.sessionId, answerText: parsed.data.answerText, actorUserId: user.id });
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

  try {
    await publishQuestionAnswer({ questionId: parsed.data.questionId, sessionId: parsed.data.sessionId, actorUserId: user.id });
    revalidatePath(route(parsed.data.eventId));
    return;
  } catch {
    return;
  }
}
