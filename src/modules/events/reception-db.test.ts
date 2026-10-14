import { describe, expect, it } from "vitest";
import { eventReceptionists, events } from "./db";

describe("reception data model", () => {
  it("supports the reception role and event confirmation setting", () => {
    expect("checkInConfirmationRequired" in events).toBe(true);
  });

  it("defines event-scoped receptionist assignments", () => {
    expect(eventReceptionists.eventId).toBeDefined();
    expect(eventReceptionists.userId).toBeDefined();
  });
});
