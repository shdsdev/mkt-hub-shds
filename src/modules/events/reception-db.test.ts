import { describe, expect, it } from "vitest";
import { userRole } from "@/modules/users/db";
import { events } from "./db";
import { eventReceptionists } from "./reception-db";

describe("reception data model", () => {
  it("supports the reception role and event confirmation setting", () => {
    expect(userRole.enumValues).toContain("RECEPTION");
    expect("checkInConfirmationRequired" in events).toBe(true);
  });

  it("defines event-scoped receptionist assignments", () => {
    expect(eventReceptionists.eventId).toBeDefined();
    expect(eventReceptionists.userId).toBeDefined();
  });
});
