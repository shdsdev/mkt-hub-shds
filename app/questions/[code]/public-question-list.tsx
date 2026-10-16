"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PublicQuestion } from "@/modules/questions";
import { submitQuestionAction, voteQuestionAction } from "./actions";

export function PublicQuestionList({ code, questions }: { code: string; questions: PublicQuestion[] }) {
  const [state, action, pending] = useActionState(submitQuestionAction, {});
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Preguntas en vivo</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold">Sumate a la conversación</h1>
        <p className="mt-2 text-sm text-muted-foreground">Las preguntas se publican después de ser moderadas.</p>
      </header>

      <form action={action} className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <input type="hidden" name="code" value={code} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tu pregunta
          <textarea name="text" required maxLength={500} rows={4} placeholder="Escribí tu duda sobre la presentación" className="resize-y rounded-md border border-input bg-background px-3 py-2 font-normal" />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Máximo 500 caracteres.</p>
          <button type="submit" disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {pending ? "Enviando…" : "Enviar pregunta"}
          </button>
        </div>
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        {state.success ? <p role="status" className="text-sm text-emerald-600">{state.success}</p> : null}
        {state.similarQuestions?.length ? (
          <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
            <p className="font-medium">Encontramos preguntas parecidas:</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {state.similarQuestions.map((question) => <li key={question.id}>{question.text}</li>)}
            </ul>
          </div>
        ) : null}
      </form>

      <section className="space-y-3" aria-label="Preguntas publicadas">
        {questions.length === 0 ? <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Todavía no hay preguntas publicadas.</p> : null}
        {questions.map((question) => <PublicQuestion key={question.id} code={code} question={question} />)}
      </section>
    </main>
  );
}

function PublicQuestion({ code, question }: { code: string; question: PublicQuestion }) {
  const [state, action, pending] = useActionState(
    async (_previous: { error?: string; success?: string }, formData: FormData) => voteQuestionAction(formData),
    {},
  );
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <p className="text-base">{question.text}</p>
      {question.answerText && question.publishedAt ? <p className="mt-4 border-l-2 border-primary pl-3 text-sm"><strong>Respuesta:</strong> {question.answerText}</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{question.voteCount} votos</span>
        <form action={action}>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="questionId" value={question.id} />
          <button type="submit" disabled={pending} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60">Votar</button>
        </form>
      </div>
      {state.error ? <p role="alert" className="mt-2 text-xs text-destructive">{state.error}</p> : null}
    </article>
  );
}
