"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import {
  createQuestion,
  getParticipantByToken,
  getQuestionSessionByCode,
  registerQuestionParticipant,
  voteForQuestion,
  questionParticipantSchema,
  questionTextSchema,
} from "@/modules/questions";

export type PublicQuestionActionState = { error?: string; success?: string; registered?: boolean };

function cookieName(sessionId: string) {
  return `questions_participant_${sessionId}`;
}

async function getParticipant(code: string) {
  const session = await getQuestionSessionByCode(code);
  if (!session || session.status !== "open") return undefined;
  const token = (await cookies()).get(cookieName(session.id))?.value;
  if (!token) return undefined;
  const participant = await getParticipantByToken({ sessionId: session.id, token });
  return participant ? { session, participant } : undefined;
}

export async function registerParticipantAction(
  _previous: PublicQuestionActionState,
  formData: FormData,
): Promise<PublicQuestionActionState> {
  const code = String(formData.get("code") ?? "");
  const session = await getQuestionSessionByCode(code);
  if (!session || session.status !== "open") return { error: "Este portal ya no está disponible." };

  const parsed = questionParticipantSchema.safeParse({
    fullName: formData.get("fullName"),
    company: formData.get("company"),
    consentAccepted: formData.get("consentAccepted") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá tus datos." };

  const { token } = await registerQuestionParticipant({ ...parsed.data, sessionId: session.id });
  (await cookies()).set(cookieName(session.id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/questions/${code}`,
    maxAge: 60 * 60 * 24,
  });
  return { registered: true, success: "Ya podés enviar tus preguntas." };
}

export async function submitQuestionAction(
  _previous: PublicQuestionActionState,
  formData: FormData,
): Promise<PublicQuestionActionState> {
  const code = String(formData.get("code") ?? "");
  const text = questionTextSchema.safeParse(formData.get("text"));
  if (!text.success) return { error: text.error.issues[0]?.message ?? "Revisá la pregunta." };
  const context = await getParticipant(code);
  if (!context) return { error: "Completá tus datos para participar." };

  await createQuestion({ sessionId: context.session.id, participantId: context.participant.id, text: text.data });
  return { success: "Tu pregunta fue enviada para moderación." };
}

export async function voteQuestionAction(formData: FormData): Promise<PublicQuestionActionState> {
  const code = String(formData.get("code") ?? "");
  const questionId = z.string().uuid().safeParse(formData.get("questionId"));
  if (!questionId.success) return { error: "Pregunta inválida." };
  const context = await getParticipant(code);
  if (!context) return { error: "Completá tus datos para participar." };

  await voteForQuestion({ questionId: questionId.data, participantId: context.participant.id });
  return { success: "Voto registrado." };
}
