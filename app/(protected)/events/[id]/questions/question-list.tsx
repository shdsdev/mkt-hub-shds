import type { ModeratorQuestion } from "@/modules/questions";
import { moderateQuestionAction, answerQuestionAction, publishQuestionAnswerAction } from "./actions";

export function QuestionList({ eventId, sessionId, questions }: { eventId: string; sessionId: string; questions: ModeratorQuestion[] }) {
  if (questions.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Todavía no hay preguntas.</div>;
  }

  return (
    <section className="space-y-3">
      {questions.map((question) => (
        <article key={question.id} className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{question.participantName} · {question.participantCompany}</p>
              <p className="mt-2 text-base">{question.text}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{question.voteCount} votos</p>
              <p className="capitalize">{question.status}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {question.status === "pending" ? (
              <>
                <ModerationForm eventId={eventId} sessionId={sessionId} questionId={question.id} status="approved" label="Aprobar" />
                <ModerationForm eventId={eventId} sessionId={sessionId} questionId={question.id} status="rejected" label="Rechazar" />
              </>
            ) : null}
            {question.status === "approved" ? <AnswerForm eventId={eventId} sessionId={sessionId} questionId={question.id} /> : null}
            {question.status === "answered" && question.publishedAt === null ? (
              <form action={publishQuestionAnswerAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="questionId" value={question.id} />
                <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Publicar respuesta</button>
              </form>
            ) : null}
            {question.status !== "archived" ? <ModerationForm eventId={eventId} sessionId={sessionId} questionId={question.id} status="archived" label="Archivar" /> : null}
          </div>

          {question.answerText ? <p className="rounded-md bg-muted/40 p-3 text-sm"><strong>Respuesta:</strong> {question.answerText}</p> : null}
        </article>
      ))}
    </section>
  );
}

function ModerationForm({ eventId, sessionId, questionId, status, label }: { eventId: string; sessionId: string; questionId: string; status: "approved" | "rejected" | "archived"; label: string }) {
  return (
    <form action={moderateQuestionAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted">{label}</button>
    </form>
  );
}

function AnswerForm({ eventId, sessionId, questionId }: { eventId: string; sessionId: string; questionId: string }) {
  return (
    <form action={answerQuestionAction} className="flex w-full flex-col gap-2 sm:flex-row">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="questionId" value={questionId} />
      <input name="answerText" maxLength={500} required placeholder="Redactar respuesta" className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
      <button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Guardar respuesta</button>
    </form>
  );
}
