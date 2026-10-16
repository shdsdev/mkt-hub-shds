import { getQuestionSessionByCode, getParticipantByToken, listPublicQuestions } from "@/modules/questions";
import { cookies } from "next/headers";
import { ParticipantForm } from "./participant-form";
import { PublicQuestionList } from "./public-question-list";

function participantCookie(sessionId: string) {
  return `questions_participant_${sessionId}`;
}

export default async function PublicQuestionsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getQuestionSessionByCode(code);
  if (!session || session.status !== "open") {
    return <main className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">Este portal de preguntas ya no está disponible.</main>;
  }

  const token = (await cookies()).get(participantCookie(session.id))?.value;
  const participant = token ? await getParticipantByToken({ sessionId: session.id, token }) : undefined;
  if (!participant) {
    return <main className="flex min-h-screen items-center justify-center bg-background p-6"><ParticipantForm code={code} /></main>;
  }

  const questions = await listPublicQuestions(session.id, participant.id);
  return <PublicQuestionList code={code} questions={questions} />;
}
