import { z } from "zod";

export const CLIENT_BRAND_OPTIONS = ["shades", "bmighty", "drapery"] as const;
export const INTEREST_OPTIONS = [
  "battery-motors",
  "wifi-automation",
  "curtains",
  "manual-and-motorized-rods",
] as const;

export type ClientBrandOption = (typeof CLIENT_BRAND_OPTIONS)[number];
export type InterestOption = (typeof INTEREST_OPTIONS)[number];

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
const interestOptionSchema = z.enum(INTEREST_OPTIONS);

export const registrationFormConfigSchema = z.object({
  version: z.literal(1),
  fields: z.object({
    phone: visibilitySchema,
    company: visibilitySchema,
    jobTitle: visibilitySchema,
  }),
  companion: z.object({ enabled: z.boolean() }),
  clientBrands: z.object({
    enabled: z.boolean(),
    options: z.array(clientBrandOptionSchema),
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

export type RegistrationFormConfig = z.infer<typeof registrationFormConfigSchema>;

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
    fields: {
      phone: { visible: false, required: false },
      company: { visible: event.collectCompany, required: false },
      jobTitle: { visible: event.collectJobTitle, required: false },
    },
    companion: { enabled: false },
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
