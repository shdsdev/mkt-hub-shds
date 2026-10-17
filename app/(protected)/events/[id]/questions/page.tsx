import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent, getEvent } from "@/modules/events";
import { isActive } from "@/modules/users";
import { getQuestionMetrics, getQuestionSession, listModeratorQuestions, listQuestionTopics, type QuestionStatus } from "@/modules/questions";
import { EventSubNav } from "../../event-sub-nav";
import { QuestionList } from "./question-list";
import { QuestionSessionPanel } from "./question-session-panel";
import { QuestionLiveRefresh } from "./question-live-refresh";
import { createQuestionTopicAction } from "./actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default async function QuestionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; search?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) notFound();
  const { id } = await params;
  const event = await getEvent(id, user.profile.organizationId);
  if (!event) notFound();
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId: event.id, capability: "questions" }))) notFound();

  const session = await getQuestionSession(event.id, user.profile.organizationId);
  const appOrigin = env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/+$/, "");
  const publicUrl = session?.publicToken ? `${appOrigin}/questions/${session.publicToken}` : undefined;
  const query = await searchParams;
  const status = ["pending", "approved", "rejected", "answered", "archived"].includes(query.status ?? "") ? query.status as QuestionStatus : undefined;
  const statusLabels: Record<string, string> = {
    all: "Todos los estados",
    pending: "Pendientes",
    approved: "Aprobadas",
    answered: "Respondidas",
    rejected: "Rechazadas",
    archived: "Archivadas",
  };
  const selectedStatus = query.status ?? "all";
  const [questions, topics] = session ? await Promise.all([listModeratorQuestions(session.id, { status, search: query.search?.trim() || undefined }), listQuestionTopics(session.id)]) : [[], []];
  const metrics = session ? await getQuestionMetrics(session.id) : undefined;

  return (
    <QuestionLiveRefresh>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
        <EventSubNav eventId={event.id} current="questions" role={user.profile.role} />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-10">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Preguntas: {event.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Moderá las preguntas del público y publicá respuestas durante la presentación.</p>
        </div>
        <QuestionSessionPanel eventId={event.id} session={session} publicUrl={publicUrl} />
        {metrics ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Participantes" value={metrics.uniqueParticipants} />
            <Metric label="Preguntaron" value={metrics.participantsWhoAsked} />
            <Metric label="Preguntas" value={metrics.receivedQuestions} />
            <Metric label="Respondidas" value={`${metrics.answeredQuestions} (${Math.round(metrics.responseRate * 100)}%)`} />
          </dl>
        ) : null}
        {session ? (
          <form action={createQuestionTopicAction} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4">
            <input type="hidden" name="eventId" value={event.id} /><input type="hidden" name="sessionId" value={session.id} />
            <label htmlFor="new-topic" className="text-sm font-medium">Nuevo tema</label><input id="new-topic" name="name" required maxLength={100} placeholder="Ej. Producto" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" /><button type="submit" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">Agregar</button>
          </form>
        ) : null}
        {session ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <a href={`/events/${event.id}/questions/export?format=csv`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">CSV anónimo</a>
            <a href={`/events/${event.id}/questions/export?format=pdf`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">PDF anónimo</a>
            <a href={`/events/${event.id}/questions/export?format=csv&scope=internal`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">CSV interno</a>
            <a href={`/events/${event.id}/questions/export?format=pdf&scope=internal`} className="rounded-full border border-border px-3 py-1.5 hover:bg-muted">PDF interno</a>
          </div>
        ) : null}
        {session ? (
          <form method="get" className="flex flex-wrap gap-2">
            <input name="search" defaultValue={query.search} placeholder="Buscar pregunta" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <Select name="status" defaultValue={selectedStatus}>
              <SelectTrigger className="min-w-44" aria-label="Filtrar por estado"><SelectValue>{statusLabels[selectedStatus]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="approved">Aprobadas</SelectItem>
                <SelectItem value="answered">Respondidas</SelectItem>
                <SelectItem value="rejected">Rechazadas</SelectItem>
                <SelectItem value="archived">Archivadas</SelectItem>
              </SelectContent>
            </Select>
            <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">Filtrar</button>
          </form>
        ) : null}
        {session ? <QuestionList eventId={event.id} sessionId={session.id} questions={questions} topics={topics} /> : null}
        </div>
      </div>
    </QuestionLiveRefresh>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><dt className="text-xs uppercase text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd></div>;
}
