import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: { MARKETING_HUB_SERVER_TOKEN: "test-token" } }));

import { getEligibleAudienceStatuses, normalizeEmailTagName } from "./service";
import { buildAudienceSummary } from "./audience-summary";

describe("email audience tags", () => {
  it("normalizes display whitespace and case for tag matching", () => {
    expect(normalizeEmailTagName("  Drapery   ")).toBe("drapery");
    expect(normalizeEmailTagName("BMIGHTY")).toBe("bmighty");
  });

  it("keeps only subscribed contacts eligible for campaigns", () => {
    expect(getEligibleAudienceStatuses()).toEqual(["subscribed"]);
    expect(getEligibleAudienceStatuses({ subscriptionStatuses: ["subscribed", "pending"] })).toEqual(["subscribed"]);
    expect(getEligibleAudienceStatuses({ subscriptionStatuses: ["pending"] })).toEqual([]);
  });

  it("derives excluded contacts without allowing negative counts", () => {
    expect(buildAudienceSummary({ matchedContactCount: 10, eligibleContactCount: 7 })).toEqual({
      matchedContactCount: 10,
      eligibleContactCount: 7,
      excludedContactCount: 3,
    });
    expect(buildAudienceSummary({ matchedContactCount: 2, eligibleContactCount: 5 }).excludedContactCount).toBe(0);
  });
});
