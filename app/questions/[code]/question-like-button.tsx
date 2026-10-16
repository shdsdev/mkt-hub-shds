"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ThumbsUp } from "lucide-react";
import type { PublicQuestion } from "@/modules/questions";
import { voteQuestionAction, type PublicQuestionActionState } from "./actions";

type VoteSnapshot = { voted: boolean; voteCount: number };

export function QuestionLikeButton({ code, question }: { code: string; question: PublicQuestion }) {
  const [voted, setVoted] = useState(question.hasVoted);
  const [voteCount, setVoteCount] = useState(question.voteCount);
  const previous = useRef<VoteSnapshot | undefined>(undefined);
  const serverState = useRef({ voted: question.hasVoted, voteCount: question.voteCount });
  const [state, action, pending] = useActionState(
    async (_previous: PublicQuestionActionState, formData: FormData) => {
      try {
        return await voteQuestionAction(formData);
      } catch {
        return { error: "No pudimos actualizar tu voto." };
      }
    },
    {},
  );

  useEffect(() => {
    const next = { voted: question.hasVoted, voteCount: question.voteCount };
    if (next.voted !== serverState.current.voted || next.voteCount !== serverState.current.voteCount) {
      serverState.current = next;
      if (!pending) {
        setVoted(next.voted);
        setVoteCount(next.voteCount);
      }
    }
  }, [pending, question.hasVoted, question.voteCount]);

  useEffect(() => {
    if (!pending && state.error && previous.current) {
      setVoted(previous.current.voted);
      setVoteCount(previous.current.voteCount);
      previous.current = undefined;
    } else if (!pending && !state.error) {
      previous.current = undefined;
    }
  }, [pending, state.error]);

  function handleSubmit() {
    previous.current = { voted, voteCount };
    setVoted(!voted);
    setVoteCount(voteCount + (voted ? -1 : 1));
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={action} onSubmit={handleSubmit}>
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="questionId" value={question.id} />
        <button
          type="submit"
          disabled={pending}
          aria-label={voted ? "Quitar voto" : "Votar pregunta"}
          title={voted ? "Quitar voto" : "Votar pregunta"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 motion-safe:active:scale-90 disabled:cursor-wait disabled:opacity-60 ${voted ? "border-sky-200 bg-sky-50 text-sky-600" : "border-black/[0.1] text-[#6b6b6b] hover:border-sky-200 hover:text-sky-600"}`}
        >
          <ThumbsUp aria-hidden="true" className={`size-4 ${voted ? "fill-current" : ""}`} />
          <span aria-live="polite">{voteCount}</span>
        </button>
      </form>
      {state.error ? <p role="alert" className="text-xs text-red-600">{state.error}</p> : null}
    </div>
  );
}
