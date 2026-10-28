import { describe, expect, it, vi } from "vitest";
import { getPrimaryAttendee, getRegistrationSourceBadgeClass, getRegistrationSourceDisplayLabel, getRegistrationSourceLabel, getRegistrationTableValues, isMetaAdsRegistration } from "./registrations-table-model";

vi.mock("@/lib/env", () => ({ env: { DATABASE_URL: "postgres://localhost:5432/test" } }));
vi.mock("@/modules/users", () => ({ isAdmin: () => true }));

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
        state: "jalisco",
      checkedInAt: null,
      occupation: "architect-decorator",
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
      state: "Jalisco",
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

  it("identifies paid Meta registrations from source and medium", () => {
    expect(isMetaAdsRegistration({ ...registrationData, utmSource: "facebook", utmMedium: "paid_social" } as never)).toBe(true);
    expect(isMetaAdsRegistration({ ...registrationData, utmSource: "facebook", utmMedium: "social" } as never)).toBe(false);
  });

  it("labels the registration source with useful fallbacks", () => {
    expect(getRegistrationSourceLabel({ ...registrationData, utmSource: "facebook", utmMedium: "paid_social" } as never)).toBe("Meta Ads");
    expect(getRegistrationSourceLabel({ ...registrationData, utmSource: "google", utmMedium: "cpc" } as never)).toBe("google");
    expect(getRegistrationSourceLabel({ ...registrationData, utmSource: null, source: "admin_added" } as never)).toBe("Admin");
    expect(getRegistrationSourceLabel({ ...registrationData, utmSource: null, source: "public" } as never)).toBe("Sin atribución");
  });

  it("assigns channel colors to registration source badges", () => {
    expect(getRegistrationSourceBadgeClass("whatsapp")).toContain("emerald");
    expect(getRegistrationSourceBadgeClass("Instagram")).toContain("pink");
    expect(getRegistrationSourceBadgeClass("google")).toContain("amber");
    expect(getRegistrationSourceBadgeClass("email")).toContain("violet");
    expect(getRegistrationSourceBadgeClass("Admin")).toContain("cyan");
    expect(getRegistrationSourceBadgeClass("Sin atribución")).toContain("muted");
  });

  it("groups web UTM sources for display without changing the original source label", () => {
    expect(getRegistrationSourceLabel({ ...registrationData, utmSource: "bmighty_sitioweb" } as never)).toBe("bmighty_sitioweb");
    expect(getRegistrationSourceDisplayLabel({ ...registrationData, utmSource: "shadesdemexico_web" } as never)).toBe("Sitio web");
    expect(getRegistrationSourceDisplayLabel({ ...registrationData, utmSource: "otra-website" } as never)).toBe("Sitio web");
    expect(getRegistrationSourceDisplayLabel({ ...registrationData, utmSource: "webinar" } as never)).toBe("webinar");
    expect(getRegistrationSourceBadgeClass("Sitio web")).toContain("teal");
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
