import { describe, expect, it } from "vitest";
import { summarizeRecipientStatuses } from "./delivery-summary";

describe("summarizeRecipientStatuses", () => {
  it("keeps the delivery lifecycle visible in recipient counts", () => {
    expect(summarizeRecipientStatuses([
      { status: "pending", count: 2 },
      { status: "sent", count: 3 },
      { status: "delivered", count: 4 },
      { status: "bounced", count: 1 },
      { status: "failed", count: 2 },
      { status: "suppressed", count: 1 },
    ])).toEqual({
      total: 13,
      pending: 2,
      sent: 3,
      delivered: 4,
      bounced: 1,
      failed: 2,
      suppressed: 1,
    });
  });
});
