import { describe, expect, it } from "vitest";
import { summarizeReminderStatuses } from "./reminder-diagnostics";

describe("summarizeReminderStatuses", () => {
  it("classifies due attendees by their reminder notification status", () => {
    expect(
      summarizeReminderStatuses([
        { attendeeId: "att-1", status: undefined },
        { attendeeId: "att-2", status: "pending" },
        { attendeeId: "att-3", status: "failed" },
        { attendeeId: "att-4", status: "sent" },
      ]),
    ).toEqual({
      total: 4,
      missing: 1,
      pending: 1,
      failed: 1,
      sent: 1,
      blocked: 2,
    });
  });

  it("does not treat unknown statuses as safely deliverable", () => {
    expect(
      summarizeReminderStatuses([{ attendeeId: "att-1", status: "unknown" }]),
    ).toEqual({
      total: 1,
      missing: 0,
      pending: 0,
      failed: 0,
      sent: 0,
      blocked: 1,
    });
  });
});
