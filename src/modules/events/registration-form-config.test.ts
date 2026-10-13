import { describe, expect, it } from "vitest";
import {
  getDefaultRegistrationFormConfig,
  registrationFormConfigSchema,
  resolveRegistrationFormConfig,
} from "./registration-form-config";

describe("registration form configuration", () => {
  it("uses compatibility defaults for an event without explicit configuration", () => {
    const config = resolveRegistrationFormConfig({
      registrationFormConfig: null,
      collectCompany: true,
      collectJobTitle: false,
    });

    expect(config.fields.company).toEqual({ visible: true, required: false });
    expect(config.fields.jobTitle).toEqual({ visible: false, required: false });
    expect(config.consent.privacy).toEqual({ url: "/privacy", text: "Acepto la política de privacidad" });
  });

  it("rejects a required hidden field", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });
    expect(() => registrationFormConfigSchema.parse({
      ...config,
      fields: {
        ...config.fields,
        phone: { visible: false, required: true },
      },
    })).toThrow();
  });

  it("accepts only fixed client-brand and interest option values", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });
    expect(() => registrationFormConfigSchema.parse({
      ...config,
      clientBrands: { enabled: true, options: ["shades"] },
      interests: { enabled: true, options: ["curtains"] },
    })).not.toThrow();
  });
});
