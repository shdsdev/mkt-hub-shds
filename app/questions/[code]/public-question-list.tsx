"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PublicQuestion } from "@/modules/questions";
import { submitQuestionAction } from "./actions";
import { QuestionLikeButton } from "./question-like-button";

export function PublicQuestionList({ code, questions }: { code: string; questions: PublicQuestion[] }) {
  const [state, action, pending] = useActionState(submitQuestionAction, {});
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <main className="min-h-screen w-full bg-[#fbfaf7] px-4 py-8 text-[#202020]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-600">Preguntas en vivo</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold">Sumate a la conversación</h1>
          <p className="mt-2 text-sm text-[#6b6b6b]">Las preguntas se publican después de ser moderadas.</p>
        </header>

        <form action={action} className="space-y-3 rounded-2xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <input type="hidden" name="code" value={code} />
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Tu pregunta
            <textarea name="text" required maxLength={500} rows={4} placeholder="Escribí tu duda sobre la presentación" className="resize-y rounded-md border border-black/[0.12] bg-white px-3 py-2 font-normal outline-none transition-shadow placeholder:text-[#8a8a8a] focus:ring-2 focus:ring-sky-500/30" />
          </label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[#6b6b6b]">Máximo 500 caracteres.</p>
            <button type="submit" disabled={pending} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-60">
              {pending ? "Enviando…" : "Enviar pregunta"}
            </button>
          </div>
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <p role="status" className="text-sm text-emerald-600">{state.success}</p> : null}
          {state.similarQuestions?.length ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm">
              <p className="font-medium">Encontramos preguntas parecidas:</p>
              <ul className="mt-1 list-disc pl-5 text-[#6b6b6b]">
                {state.similarQuestions.map((question) => <li key={question.id}>{question.text}</li>)}
              </ul>
            </div>
          ) : null}
        </form>

        <section className="space-y-3" aria-label="Preguntas publicadas">
          {questions.length === 0 ? <p className="rounded-lg border border-dashed border-black/[0.12] p-8 text-center text-sm text-[#6b6b6b]">Todavía no hay preguntas publicadas.</p> : null}
          {questions.map((question) => <PublicQuestion key={question.id} code={code} question={question} />)}
        </section>
      </div>
    </main>
  );
}

function PublicQuestion({ code, question }: { code: string; question: PublicQuestion }) {
  return (
    <article className="rounded-xl border border-black/[0.08] bg-white/90 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-xs text-[#6b6b6b]">{question.participantName}</p>
      <p className="mt-2 break-words text-base">{question.text}</p>
      {question.answerText && question.publishedAt ? <p className="mt-4 break-words border-l-2 border-sky-500 pl-3 text-sm"><strong>Respuesta:</strong> {question.answerText}</p> : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <QuestionLikeButton code={code} question={question} />
      </div>
    </article>
  );
}
