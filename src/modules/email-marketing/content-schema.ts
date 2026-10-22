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
  blocks: z.array(emailContentBlockSchema).max(50),
});

export type EmailContentBlock = z.infer<typeof emailContentBlockSchema>;
export type EmailContentDocument = z.infer<typeof emailContentDocumentSchema>;

export function parseEmailContentDocument(input: unknown): EmailContentDocument {
  return emailContentDocumentSchema.parse(input);
}
