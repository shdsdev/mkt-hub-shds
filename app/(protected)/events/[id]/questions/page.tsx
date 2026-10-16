import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, getEvent } from "@/modules/events";
import { isActive } from "@/modules/users";
import { getQuestionSession, listModeratorQuestions } from "@/modules/questions";
import { EventSubNav } from "../../event-sub-nav";
import { QuestionList } from "./question-list";
import { QuestionSessionPanel } from "./question-session-panel";

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();
  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "questions" }))) notFound();

  const session = await getQuestionSession(event.id, user.profile.organizationId);
  const questions = session ? await listModeratorQuestions(session.id) : [];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <EventSubNav eventId={event.id} current="questions" role={user.profile.role} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-10">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Preguntas: {event.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Moderá las preguntas del público y publicá respuestas durante la presentación.</p>
        </div>
        <QuestionSessionPanel eventId={event.id} session={session} />
        {session ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <a href={`/events/${event.id}/questions/export?format=csv`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">CSV anónimo</a>
            <a href={`/events/${event.id}/questions/export?format=pdf`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">PDF anónimo</a>
            <a href={`/events/${event.id}/questions/export?format=csv&scope=internal`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">CSV interno</a>
            <a href={`/events/${event.id}/questions/export?format=pdf&scope=internal`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">PDF interno</a>
          </div>
        ) : null}
        {session ? <QuestionList eventId={event.id} sessionId={session.id} questions={questions} /> : null}
      </div>
    </div>
  );
}
