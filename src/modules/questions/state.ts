export const QUESTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "answered",
  "archived",
] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

const transitions: Record<QuestionStatus, readonly QuestionStatus[]> = {
  pending: ["approved", "rejected", "archived"],
  approved: ["answered", "archived"],
  rejected: [],
  answered: ["approved", "archived"],
  archived: ["approved"],
};

export function canTransitionQuestionStatus(from: QuestionStatus, to: QuestionStatus): boolean {
  return transitions[from].includes(to);
}
