import { z } from "zod";

const subscriptionStatusSchema = z.enum([
  "subscribed",
  "unsubscribed",
  "suppressed",
  "pending",
]);

const registrationStatusSchema = z.enum([
  "pending_review",
  "confirmed",
  "waitlisted",
  "rejected",
  "cancelled",
  "checked_in",
]);

const stringListSchema = z.array(z.string().trim().min(1).max(120)).max(50);

export const emailSegmentDefinitionSchema = z.object({
  version: z.literal(1),
  filters: z
    .object({
      subscriptionStatuses: z.array(subscriptionStatusSchema).max(4).optional(),
      eventIds: z.array(z.string().uuid()).max(100).optional(),
      registrationStatuses: z.array(registrationStatusSchema).max(6).optional(),
      interests: stringListSchema.optional(),
      clientBrands: stringListSchema.optional(),
      attributes: z.record(z.string().trim().min(1).max(80), z.string().trim().max(200)).optional(),
    })
    .strict(),
});

export type EmailSegmentDefinition = z.infer<typeof emailSegmentDefinitionSchema>;

export function parseEmailSegmentDefinition(input: unknown): EmailSegmentDefinition {
  return emailSegmentDefinitionSchema.parse(input);
}
