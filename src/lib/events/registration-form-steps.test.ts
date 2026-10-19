import { describe, expect, it } from "vitest";
import { getRegistrationFormSteps } from "./registration-form-steps";

function getConfig() {
  return {
    customFields: [],
    companion: { enabled: true },
    clientBrands: { enabled: false, options: [] },
    interests: { enabled: false, options: [] },
  };
}

describe("getRegistrationFormSteps", () => {
  it("omits the preferences step when the event has no preferences or companion", () => {
    const config = getConfig();

    expect(getRegistrationFormSteps({ ...config, companion: { enabled: false } })).toEqual([
      { id: "personal", label: "Tus datos" },
      { id: "confirmation", label: "Revisá y confirmá" },
    ]);
  });

  it("includes preferences when brands, interests, custom fields, or companion are enabled", () => {
    const config = getConfig();

    expect(getRegistrationFormSteps({ ...config, clientBrands: { enabled: true, options: ["shades"] } })).toHaveLength(3);
    expect(getRegistrationFormSteps({ ...config, interests: { enabled: true, options: ["curtains"] } })).toHaveLength(3);
    expect(getRegistrationFormSteps({
      ...config,
      customFields: [{ enabled: true, section: "preferences" as const }],
    })).toHaveLength(3);
    expect(getRegistrationFormSteps(config)).toHaveLength(3);
  });
});
