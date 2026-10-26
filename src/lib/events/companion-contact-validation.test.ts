import { describe, expect, it } from "vitest";
import { getCompanionContactErrors } from "./companion-contact-validation";

describe("companion contact validation", () => {
  it("rejects a companion email matching the primary email regardless of case or spaces", () => {
    expect(getCompanionContactErrors({
      primaryEmail: "  Cliente@Example.com ",
      companionEmail: "cliente@example.com",
      primaryPhone: "",
      companionPhone: "",
    })).toEqual({ companionEmail: "El correo del acompañante no puede ser igual al del titular." });
  });

  it("rejects a companion phone matching the primary phone regardless of formatting", () => {
    expect(getCompanionContactErrors({
      primaryEmail: "primary@example.com",
      companionEmail: "companion@example.com",
      primaryPhone: "+52 33 1234-5678",
      companionPhone: "523312345678",
    })).toEqual({ companionPhone: "El teléfono del acompañante no puede ser igual al del titular." });
  });

  it("allows distinct contact details", () => {
    expect(getCompanionContactErrors({
      primaryEmail: "primary@example.com",
      companionEmail: "companion@example.com",
      primaryPhone: "+52 33 1234 5678",
      companionPhone: "+52 33 8765 4321",
    })).toEqual({});
  });
});
