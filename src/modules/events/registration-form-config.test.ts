import { describe, expect, it } from "vitest";
import {
  MEXICAN_STATES,
  getDefaultRegistrationFormConfig,
  registrationFormConfigSchema,
  resolveRegistrationFormConfig,
  toggleClientBrandOption,
} from "./registration-form-config";

const customField = (overrides: Record<string, unknown> = {}) => ({
  id: "company-size",
  type: "select_multiple",
  label: "Tamaño de empresa",
  description: "Elegí una o más opciones",
  required: true,
  enabled: true,
  position: 0,
  options: [
    { value: "small", label: "Pequeña" },
    { value: "medium", label: "Mediana" },
  ],
  ...overrides,
});

describe("registration form configuration", () => {
  it("uses compatibility defaults for an event without explicit configuration", () => {
    const config = resolveRegistrationFormConfig({
      registrationFormConfig: null,
      collectCompany: true,
      collectJobTitle: false,
    });

    expect(config.fields.company).toEqual({ visible: true, required: false });
    expect(config.fields.jobTitle).toEqual({ visible: false, required: false });
    expect(config.fields.state).toEqual({ visible: false, required: false });
    expect(config.consent.privacy).toEqual({ url: "/privacy", text: "Acepto la política de privacidad" });
  });

  it("provides all Mexican states for the single-select state field", () => {
    expect(MEXICAN_STATES).toHaveLength(32);
    expect(MEXICAN_STATES).toContainEqual({ value: "jalisco", label: "Jalisco" });
    expect(new Set(MEXICAN_STATES.map((state) => state.value)).size).toBe(32);
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

  it("rejects none combined with another client brand", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });
    expect(() => registrationFormConfigSchema.parse({
      ...config,
      clientBrands: { enabled: true, options: ["none", "shades"] },
    })).toThrow();
  });

  it("defaults custom fields for legacy configurations", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });

    expect(config.customFields).toEqual([]);
    expect(config.customFieldsVersion).toBe(1);
  });

  it("defaults legacy custom fields to the personal section", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });

    const parsed = registrationFormConfigSchema.parse({
      ...config,
      customFields: [customField()],
    });

    expect(parsed.customFields[0].section).toBe("personal");
  });

  it("accepts custom fields assigned to preferences", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });

    const parsed = registrationFormConfigSchema.parse({
      ...config,
      customFields: [customField({ section: "preferences" })],
    });

    expect(parsed.customFields[0].section).toBe("preferences");
  });

  it("accepts every supported custom field type", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });
    const types = [
      "short_text",
      "long_text",
      "number",
      "email",
      "phone",
      "date",
      "checkbox",
      "select",
      "select_multiple",
    ] as const;

    expect(() => registrationFormConfigSchema.parse({
      ...config,
      customFields: types.map((type, position) => customField({
        id: `field-${position}`,
        type,
        label: `Campo ${position}`,
        required: false,
        position,
        ...(type === "checkbox" ? {
          link: { url: "/terms", text: "Ver términos" },
        } : {}),
        ...(type === "select" || type === "select_multiple" ? {
          options: [{ value: "one", label: "Uno" }],
        } : {}),
        ...(type !== "select" && type !== "select_multiple" ? { options: undefined } : {}),
      })),
    })).not.toThrow();
  });

  it("rejects duplicate custom field IDs and required disabled fields", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });

    expect(() => registrationFormConfigSchema.parse({
      ...config,
      customFields: [customField(), customField({ position: 1 })],
    })).toThrow();

    expect(() => registrationFormConfigSchema.parse({
      ...config,
      customFields: [customField({ enabled: false })],
    })).toThrow();
  });

  it("validates custom checkbox links and select options", () => {
    const config = getDefaultRegistrationFormConfig({ collectCompany: false, collectJobTitle: false });

    expect(() => registrationFormConfigSchema.parse({
      ...config,
      customFields: [customField({ type: "checkbox", options: undefined, link: { url: "javascript:alert(1)", text: "Unsafe" } })],
    })).toThrow();

    expect(() => registrationFormConfigSchema.parse({
      ...config,
      customFields: [customField({ options: [{ value: "same", label: "Uno" }, { value: "same", label: "Dos" }] })],
    })).toThrow();
  });

  it("keeps Ninguna mutually exclusive with explicit brand selections", () => {
    expect(toggleClientBrandOption([], "none", true)).toEqual(["none"]);
    expect(toggleClientBrandOption(["none"], "shades", true)).toEqual(["shades"]);
    expect(toggleClientBrandOption(["shades"], "none", true)).toEqual(["none"]);
    expect(toggleClientBrandOption(["shades", "bmighty"], "shades", false)).toEqual(["bmighty"]);
  });
});
