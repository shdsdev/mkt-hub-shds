import { describe, expect, it } from "vitest";
import { getRecipientDeliveryStatus } from "./delivery-events";

describe("getRecipientDeliveryStatus", () => {
  it.each([
    ["email.delivered", "delivered"],
    ["email.bounced", "bounced"],
    ["email.suppressed", "suppressed"],
    ["email.complained", "suppressed"],
    ["email.failed", "failed"],
    ["email.delivery_delayed", null],
  ] as const)("maps %s to %s", (eventType, expected) => {
    expect(getRecipientDeliveryStatus(eventType)).toBe(expected);
  });

  it("ignores provider events unrelated to delivery state", () => {
    expect(getRecipientDeliveryStatus("email.sent")).toBeNull();
  });
});
