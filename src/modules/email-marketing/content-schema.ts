import { z } from "zod";

const blockIdSchema = z.string().trim().min(1).max(80);

const textBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("text"),
  text: z.string().max(10_000),
});

const imageBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("image"),
  src: z.string().trim().url().max(2_048),
  alt: z.string().max(300),
});

const buttonBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("button"),
  label: z.string().trim().min(1).max(200),
  href: z.string().trim().url().max(2_048),
});

const dividerBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("divider"),
});

const columnsBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("columns"),
  columns: z.array(z.string().max(5_000)).min(1).max(2),
});

const variableBlockSchema = z.object({
  id: blockIdSchema,
  type: z.literal("variable"),
  name: z.enum(["first_name", "event_name", "event_date"]),
  fallback: z.string().max(200).default(""),
});

export const emailContentBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
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
