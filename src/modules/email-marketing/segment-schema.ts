import { z } from "zod";

const subscriptionStatusSchema = z.enum([
  "subscribed",
  "unsubscribed",
  "suppressed",
  "pending",
]);

const stringListSchema = z.array(z.string().trim().min(1).max(120)).max(50);

export const emailSegmentConditionSchema = z.object({
  field: z.enum(["fullName", "email", "company", "tag", "event", "subscriptionStatus"]),
  operator: z.enum(["contains", "not_contains", "equals", "not_equals", "is_empty", "is_not_empty", "has", "not_has"]),
  value: z.string().trim().max(320),
});

export const emailSegmentDefinitionSchema = z.object({
  version: z.literal(1),
  filters: z
    .object({
      subscriptionStatuses: z.array(subscriptionStatusSchema).max(4).optional(),
      eventIds: z.array(z.string().uuid()).max(100).optional(),
      tags: stringListSchema.optional(),
      logic: z.enum(["all", "any"]).default("all"),
      conditions: z.array(emailSegmentConditionSchema).max(20).optional(),
    })
    .strict(),
});

export type EmailSegmentDefinition = z.infer<typeof emailSegmentDefinitionSchema>;
export type EmailSegmentCondition = z.infer<typeof emailSegmentConditionSchema>;

export function parseEmailSegmentDefinition(input: unknown): EmailSegmentDefinition {
  return emailSegmentDefinitionSchema.parse(input);
}
