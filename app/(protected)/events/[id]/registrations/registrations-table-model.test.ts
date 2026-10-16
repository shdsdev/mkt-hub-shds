import { describe, expect, it } from "vitest";
import { getPrimaryAttendee, getRegistrationTableValues } from "./registrations-table-model";

const registrationData = {
  id: "reg-1",
  status: "confirmed",
  createdAt: new Date("2026-10-13T20:44:00.000Z"),
  source: "public",
  clientBrands: ["shades"],
  interests: ["battery-motors", "curtains"],
  requestedMoreCompanions: true,
  utmSource: "instagram",
  attendees: [
    {
      id: "att-1",
      fullName: "María González",
      email: "maria@example.com",
      checkedInAt: null,
      occupation: "architect",
    },
    {
      id: "att-2",
      fullName: "Diego Torres",
      email: "diego@example.com",
      checkedInAt: null,
      occupation: "installer-technician",
    },
  ],
};
const registration = registrationData as never;

describe("registration table model", () => {
  it("uses the first attendee as the primary contact", () => {
    expect(getPrimaryAttendee(registration)?.fullName).toBe("María González");
  });

  it("summarizes the high-value columns without losing detail data", () => {
    expect(getRegistrationTableValues(registration)).toEqual({
      companionCount: 1,
      isClient: true,
      status: "Pendiente",
      followUp: true,
      source: "instagram",
    });
  });

  it("does not report check-in while a companion is still pending", () => {
    const partiallyCheckedIn = {
      ...registrationData,
      status: "checked_in",
      attendees: [
        { ...registrationData.attendees[0], checkedInAt: new Date("2026-10-13T21:00:00.000Z") },
        registrationData.attendees[1],
      ],
    } as never;

    expect(getRegistrationTableValues(partiallyCheckedIn).status).toBe("Confirmado");
  });

  it("reports check-in only after every attendee is validated", () => {
    const fullyCheckedIn = {
      ...registrationData,
      status: "checked_in",
      attendees: registrationData.attendees.map((attendee) => ({
        ...attendee,
        checkedInAt: new Date("2026-10-13T21:00:00.000Z"),
      })),
    } as never;

    expect(getRegistrationTableValues(fullyCheckedIn).status).toBe("Check-in");
  });
});
