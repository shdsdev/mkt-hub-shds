import { z } from "zod";

const blockIdSchema = z.string().trim().min(1).max(80);

const blockStyleSchema = z
  .object({
    align: z.enum(["left", "center", "right"]).optional(),
    backgroundColor: z.string().trim().regex(/^#[0-9a-f]{3,8}$/i).optional(),
    color: z.string().trim().regex(/^#[0-9a-f]{3,8}$/i).optional(),
    padding: z.number().int().min(0).max(96).optional(),
  })
  .default({});

const styledBlockFields = {
  style: blockStyleSchema,
};

const textBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("text"),
  text: z.string().max(10_000),
  ...styledBlockFields,
});

const headingBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("heading"),
  text: z.string().max(2_000),
  level: z.enum(["h1", "h2", "h3"]).default("h2"),
  ...styledBlockFields,
});

const imageBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("image"),
  src: z.string().trim().url().max(2_048),
  alt: z.string().max(300),
  ...styledBlockFields,
});

const buttonBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("button"),
  label: z.string().trim().min(1).max(200),
  href: z.string().trim().url().max(2_048),
  ...styledBlockFields,
});

const dividerBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("divider"),
  ...styledBlockFields,
});

const spacerBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("spacer"),
  height: z.number().int().min(4).max(240).default(32),
  ...styledBlockFields,
});

const logoBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("logo"),
  src: z.string().trim().url().max(2_048),
  alt: z.string().max(300),
  ...styledBlockFields,
});

const socialBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("social"),
  links: z.array(z.object({ label: z.string().trim().min(1).max(40), href: z.string().trim().url().max(2_048) })).max(6),
  ...styledBlockFields,
});

const htmlBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("html"),
  html: z.string().max(20_000),
  ...styledBlockFields,
});

const columnsBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("columns"),
  columns: z.array(
    z.union([
      z.string().max(5_000),
      z.object({
        id: blockIdSchema,
        blocks: z.array(z.unknown()).max(20),
      }),
    ]),
  ).min(1).max(4),
  ...styledBlockFields,
});

const variableBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("variable"),
  name: z.enum(["first_name", "event_name", "event_date"]),
  fallback: z.string().max(200).default(""),
  ...styledBlockFields,
});

export const emailContentBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  headingBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
  logoBlockSchema,
  socialBlockSchema,
  htmlBlockSchema,
  columnsBlockSchema,
  variableBlockSchema,
]);

export const emailContentDocumentSchema = z.object({
  version: z.literal(1),
  mode: z.literal("blocks").default("blocks"),
  blocks: z.array(emailContentBlockSchema).max(50),
});

export const emailHtmlDocumentSchema = z.object({
  version: z.literal(1),
  mode: z.literal("html"),
  bodyHtml: z.string().max(100_000),
});

export const emailCampaignContentSchema = z.discriminatedUnion("mode", [
  emailContentDocumentSchema,
  emailHtmlDocumentSchema,
]);

export type EmailContentBlock = z.infer<typeof emailContentBlockSchema>;
export type EmailContentDocument = z.infer<typeof emailContentDocumentSchema>;
export type EmailHtmlDocument = z.infer<typeof emailHtmlDocumentSchema>;
export type EmailCampaignContent = z.infer<typeof emailCampaignContentSchema>;

export function parseEmailContentDocument(input: unknown): EmailContentDocument {
  return emailContentDocumentSchema.parse({ mode: "blocks", ...(input as object) });
}

export function parseEmailCampaignContent(input: unknown): EmailCampaignContent {
  return emailCampaignContentSchema.parse(input);
}
