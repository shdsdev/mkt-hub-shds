export type EmailAudienceSummary = {
  matchedContactCount: number;
  eligibleContactCount: number;
  excludedContactCount: number;
};

export function buildAudienceSummary(input: {
  matchedContactCount: number;
  eligibleContactCount: number;
}): EmailAudienceSummary {
  const matchedContactCount = Math.max(0, input.matchedContactCount);
  const eligibleContactCount = Math.max(0, input.eligibleContactCount);

  return {
    matchedContactCount,
    eligibleContactCount,
    excludedContactCount: Math.max(0, matchedContactCount - eligibleContactCount),
  };
}
