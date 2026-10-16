import { describe, expect, it } from "vitest";
import { getEffectiveRegistrationStatus } from "./registration-status";

const checkedIn = { checkedInAt: new Date("2026-10-13T17:00:00.000Z") };
const pending = { checkedInAt: null };

describe("getEffectiveRegistrationStatus", () => {
  it("keeps a partially checked-in registration confirmed", () => {
    expect(getEffectiveRegistrationStatus("checked_in", [checkedIn, pending])).toBe("confirmed");
  });

  it("reports checked_in only when every attendee is checked in", () => {
    expect(getEffectiveRegistrationStatus("checked_in", [checkedIn, checkedIn])).toBe("checked_in");
  });
});
