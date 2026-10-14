import { describe, expect, it } from "vitest";
import { getCheckInResultKind } from "./check-in-result";

describe("getCheckInResultKind", () => {
  it("blocks cancelled and waitlisted registrations", () => {
    expect(getCheckInResultKind({ registrationStatus: "cancelled", checkedInAt: null })).toBe("blocked");
    expect(getCheckInResultKind({ registrationStatus: "waitlisted", checkedInAt: null })).toBe("blocked");
  });

  it("distinguishes eligible and already checked-in attendees", () => {
    expect(getCheckInResultKind({ registrationStatus: "confirmed", checkedInAt: null })).toBe("eligible");
    expect(getCheckInResultKind({ registrationStatus: "checked_in", checkedInAt: new Date() })).toBe("already_checked_in");
  });
});
