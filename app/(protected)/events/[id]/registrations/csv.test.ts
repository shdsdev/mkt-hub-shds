import { describe, expect, it } from "vitest";
import { buildRegistrationsCsv } from "./csv";

function registration(overrides: Partial<Parameters<typeof buildRegistrationsCsv>[0][number]> = {}) {
  return {
    id: "reg-1",
    eventId: "event-1",
    organizationId: "org-1",
    status: "confirmed" as const,
    source: "public" as const,
    cancelToken: "token",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    utmId: null,
    clientBrands: [],
    interests: [],
    requestedMoreCompanions: false,
    consents: null,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    updatedAt: new Date("2026-10-01T12:00:00Z"),
    attendees: [],
    ...overrides,
  };
}

describe("buildRegistrationsCsv", () => {
  it("includes a header row even with no registrations", () => {
    const csv = buildRegistrationsCsv([]);
    expect(csv).toBe(
      "fecha,estado,contacto_principal,correo_principal,acompanantes,utm_source,pase,solicita_mas_acompanantes,marcas,intereses,privacidad_aceptada,terminos_aceptados,marketing_aceptado,actividad_principal,actividad_acompanante\r\n",
    );
  });

  it("renders the primary attendee, companions, and pass status for one registration", () => {
    const row = registration({
      utmSource: "newsletter",
      attendees: [
        { id: "att-1", registrationId: "reg-1", fullName: "Ada Lovelace", email: "ada@example.com", checkedInAt: null },
        { id: "att-2", registrationId: "reg-1", fullName: "Alan Turing", email: "alan@example.com", checkedInAt: null },
      ] as never,
    });

    const csv = buildRegistrationsCsv([row]);

    expect(csv).toContain("Ada Lovelace,ada@example.com,Alan Turing,newsletter,pendiente");
  });

  it("marks the pass as registrado when the primary attendee has checked in", () => {
    const row = registration({
      attendees: [
        {
          id: "att-1",
          registrationId: "reg-1",
          fullName: "Ada Lovelace",
          email: "ada@example.com",
          checkedInAt: new Date("2026-11-01T18:05:00Z"),
        },
      ] as never,
    });

    const csv = buildRegistrationsCsv([row]);
    expect(csv).toContain(",registrado");
  });

  it("quotes a field containing a comma", () => {
    const row = registration({
      attendees: [
        { id: "att-1", registrationId: "reg-1", fullName: "Lovelace, Ada", email: "ada@example.com", checkedInAt: null },
      ] as never,
    });

    const csv = buildRegistrationsCsv([row]);
    expect(csv).toContain('"Lovelace, Ada"');
  });

  it("exports follow-up, preferences, and consent status", () => {
    const csv = buildRegistrationsCsv([registration({
      requestedMoreCompanions: true,
      clientBrands: ["shades"],
      interests: ["curtains"],
      consents: {
        privacyAcceptedAt: "2026-10-13T10:00:00.000Z",
        termsAcceptedAt: "2026-10-13T10:00:00.000Z",
      },
    })]);

    expect(csv).toContain("sí,Shades,Cortinería,2026-10-13T10:00:00.000Z,2026-10-13T10:00:00.000Z");
  });

  it("exports primary and companion occupation", () => {
    const csv = buildRegistrationsCsv([registration({
      attendees: [
        { id: "att-1", registrationId: "reg-1", fullName: "Ada Lovelace", email: "ada@example.com", occupation: "architect", checkedInAt: null },
        { id: "att-2", registrationId: "reg-1", fullName: "Alan Turing", email: "alan@example.com", occupation: "installer-technician", checkedInAt: null },
      ] as never,
    })]);

    expect(csv).toContain("Arquitecto,Instalador o técnico");
  });
});
