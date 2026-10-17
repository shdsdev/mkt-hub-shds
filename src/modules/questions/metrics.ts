export type QuestionMetricInput = {
  participantIds: string[];
  questionAuthors: string[];
  receivedQuestions: number;
  answeredQuestions: number;
  votes: number;
};

export type QuestionMetrics = {
  uniqueParticipants: number;
  participantsWhoAsked: number;
  questionsPerParticipant: number;
  receivedQuestions: number;
  answeredQuestions: number;
  responseRate: number;
  votes: number;
};

export function calculateQuestionMetrics(input: QuestionMetricInput): QuestionMetrics {
  const uniqueParticipants = new Set(input.participantIds).size;
  const participantsWhoAsked = new Set(input.questionAuthors).size;
  return {
    uniqueParticipants,
    participantsWhoAsked,
    questionsPerParticipant: uniqueParticipants === 0 ? 0 : input.receivedQuestions / uniqueParticipants,
    receivedQuestions: input.receivedQuestions,
    answeredQuestions: input.answeredQuestions,
    responseRate: input.receivedQuestions === 0 ? 0 : input.answeredQuestions / input.receivedQuestions,
    votes: input.votes,
  };
}
