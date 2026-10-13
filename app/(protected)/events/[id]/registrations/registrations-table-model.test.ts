import { describe, expect, it } from "vitest";
import { getPrimaryAttendee, getRegistrationTableValues } from "./registrations-table-model";

const registration = {
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
} as never;

describe("registration table model", () => {
  it("uses the first attendee as the primary contact", () => {
    expect(getPrimaryAttendee(registration)?.fullName).toBe("María González");
  });

  it("summarizes the high-value columns without losing detail data", () => {
    expect(getRegistrationTableValues(registration)).toEqual({
      companionCount: 1,
      brands: "Shades",
      interests: "Motores de baterías, Cortinería",
      pass: "Pendiente",
      followUp: true,
      source: "instagram",
    });
  });
});
