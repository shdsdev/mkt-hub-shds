import { describe, expect, it } from "vitest";
import { eventEditors, eventReceptionists, events } from "./db";

describe("reception data model", () => {
  it("supports the reception role and event confirmation setting", () => {
    expect("checkInConfirmationRequired" in events).toBe(true);
  });

  it("defines event-scoped receptionist assignments", () => {
    expect(eventReceptionists.eventId).toBeDefined();
    expect(eventReceptionists.userId).toBeDefined();
  });

  it("defines event-scoped editor assignments", () => {
    expect(eventEditors.eventId).toBeDefined();
    expect(eventEditors.userId).toBeDefined();
  });
});
