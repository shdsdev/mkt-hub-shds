import { z } from "zod";
export { MEXICAN_STATES } from "@/lib/events/mexican-states";

export const CLIENT_BRAND_OPTIONS = ["none", "shades", "bmighty", "drapery"] as const;
export const OCCUPATION_OPTIONS = [
  "distributor",
  "manufacturer",
  "architect",
  "decorator",
  "installer-technician",
] as const;
export const INTEREST_OPTIONS = [
  "battery-motors",
  "wifi-automation",
  "curtains",
  "manual-and-motorized-rods",
] as const;

export type ClientBrandOption = (typeof CLIENT_BRAND_OPTIONS)[number];
export type OccupationOption = (typeof OCCUPATION_OPTIONS)[number];
export type InterestOption = (typeof INTEREST_OPTIONS)[number];

export { toggleClientBrandOption } from "@/lib/events/registration-form-ui";

const visibilitySchema = z
  .object({
    visible: z.boolean(),
    required: z.boolean(),
  })
  .superRefine((field, context) => {
    if (field.required && !field.visible) {
      context.addIssue({
        code: "custom",
        message: "Un campo oculto no puede ser obligatorio.",
        path: ["required"],
      });
    }
  });

const consentLinkSchema = z.object({
  url: z.string().trim().min(1).refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), {
    message: "Ingresá una URL válida.",
  }),
  text: z.string().trim().min(1).max(500),
});

const clientBrandOptionSchema = z.enum(CLIENT_BRAND_OPTIONS);
const occupationOptionSchema = z.enum(OCCUPATION_OPTIONS);
const interestOptionSchema = z.enum(INTEREST_OPTIONS);

const customFieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
});

const customFieldLinkSchema = z.object({
  url: z.string().trim().min(1).refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), {
    message: "Ingresá una URL válida.",
  }),
  text: z.string().trim().min(1).max(500),
});

const customFieldSectionSchema = z.enum(["personal", "preferences"]);

const customFieldCommon = {
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "El identificador del campo no es válido."),
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500),
  required: z.boolean(),
  enabled: z.boolean(),
  position: z.number().int().min(0),
  section: customFieldSectionSchema.default("personal"),
};

const customFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...customFieldCommon, type: z.literal("short_text") }),
  z.object({ ...customFieldCommon, type: z.literal("long_text") }),
  z.object({
    ...customFieldCommon,
    type: z.literal("number"),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  }),
  z.object({ ...customFieldCommon, type: z.literal("email") }),
  z.object({ ...customFieldCommon, type: z.literal("phone") }),
  z.object({ ...customFieldCommon, type: z.literal("date") }),
  z.object({ ...customFieldCommon, type: z.literal("checkbox"), link: customFieldLinkSchema.optional() }),
  z.object({
    ...customFieldCommon,
    type: z.literal("select"),
    options: z.array(customFieldOptionSchema).min(1).max(100),
  }),
  z.object({
    ...customFieldCommon,
    type: z.literal("select_multiple"),
    options: z.array(customFieldOptionSchema).min(1).max(100),
  }),
]);

const customFieldsSchema = z.array(customFieldSchema).max(100).superRefine((fields, context) => {
  const ids = new Set<string>();

  fields.forEach((field, index) => {
    if (ids.has(field.id)) {
      context.addIssue({ code: "custom", message: "Los identificadores de campos deben ser únicos.", path: [index, "id"] });
    }
    ids.add(field.id);

    if (field.required && !field.enabled) {
      context.addIssue({ code: "custom", message: "Un campo desactivado no puede ser obligatorio.", path: [index, "required"] });
    }

    if (field.type === "number" && field.min !== undefined && field.max !== undefined && field.min > field.max) {
      context.addIssue({ code: "custom", message: "El mínimo no puede ser mayor que el máximo.", path: [index, "min"] });
    }

    if (field.type === "select" || field.type === "select_multiple") {
      const optionValues = new Set<string>();
      field.options.forEach((option, optionIndex) => {
        if (optionValues.has(option.value)) {
          context.addIssue({ code: "custom", message: "Los valores de opciones deben ser únicos.", path: [index, "options", optionIndex, "value"] });
        }
        optionValues.add(option.value);
      });
    }
  });
});

export const registrationFormConfigSchema = z.object({
  version: z.literal(1),
  customFieldsVersion: z.literal(1).default(1),
  customFields: customFieldsSchema.default([]),
  fields: z.object({
    phone: visibilitySchema,
    company: visibilitySchema,
    jobTitle: visibilitySchema,
    state: visibilitySchema.default({ visible: false, required: false }),
  }),
  companion: z.object({ enabled: z.boolean() }),
  clientBrands: z.object({
    enabled: z.boolean(),
    options: z.array(clientBrandOptionSchema),
  }).superRefine((group, context) => {
    if (group.options.includes("none") && group.options.length > 1) {
      context.addIssue({ code: "custom", message: "Ninguno no puede combinarse con una marca.", path: ["options"] });
    }
  }),
  interests: z.object({
    enabled: z.boolean(),
    options: z.array(interestOptionSchema),
  }),
  consent: z.object({
    privacy: consentLinkSchema,
    terms: consentLinkSchema,
    marketing: z.object({ enabled: z.boolean(), text: z.string().trim().min(1).max(500) }),
  }),
});

export { occupationOptionSchema };

export type RegistrationFormConfig = z.infer<typeof registrationFormConfigSchema>;
export type RegistrationCustomField = z.infer<typeof customFieldSchema>;

type RegistrationFormConfigSource = {
  registrationFormConfig?: unknown | null;
  collectCompany: boolean;
  collectJobTitle: boolean;
};

export function getDefaultRegistrationFormConfig(
  event: Pick<RegistrationFormConfigSource, "collectCompany" | "collectJobTitle">,
): RegistrationFormConfig {
  return {
    version: 1,
    customFieldsVersion: 1,
    customFields: [],
    fields: {
      phone: { visible: false, required: false },
      company: { visible: event.collectCompany, required: false },
      jobTitle: { visible: event.collectJobTitle, required: false },
      state: { visible: false, required: false },
    },
      companion: { enabled: true },
    clientBrands: { enabled: false, options: [] },
    interests: { enabled: false, options: [] },
    consent: {
      privacy: { url: "/privacy", text: "Acepto la política de privacidad" },
      terms: { url: "/terms", text: "Acepto los términos y condiciones" },
      marketing: { enabled: false, text: "Quiero recibir novedades e información de productos" },
    },
  };
}

export function resolveRegistrationFormConfig(event: RegistrationFormConfigSource): RegistrationFormConfig {
  const fallback = getDefaultRegistrationFormConfig(event);
  if (!event.registrationFormConfig) return fallback;

  const parsed = registrationFormConfigSchema.safeParse(event.registrationFormConfig);
  return parsed.success ? parsed.data : fallback;
}
