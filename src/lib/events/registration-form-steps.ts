type RegistrationStepConfig = {
  customFields: readonly { enabled: boolean; section: "personal" | "preferences" }[];
  companion: { enabled: boolean };
  clientBrands: { enabled: boolean; options: readonly string[] };
  interests: { enabled: boolean; options: readonly string[] };
};

export type RegistrationStepId = "personal" | "preferences" | "confirmation";

export type RegistrationStep = {
  id: RegistrationStepId;
  label: string;
};

export function getRegistrationFormSteps(config: RegistrationStepConfig): RegistrationStep[] {
  const hasPreferences =
    (config.clientBrands.enabled && config.clientBrands.options.length > 0) ||
    (config.interests.enabled && config.interests.options.length > 0) ||
    config.companion.enabled ||
    config.customFields.some((field) => field.enabled && field.section === "preferences");

  return [
    { id: "personal", label: "Tus datos" },
    ...(hasPreferences ? [{ id: "preferences" as const, label: "Preferencias y acompañantes" }] : []),
    { id: "confirmation", label: "Revisá y confirmá" },
  ];
}
