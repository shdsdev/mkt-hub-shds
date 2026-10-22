import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { desc, eq } from "drizzle-orm";
import {
  emailCampaigns,
  emailContactEvents,
  emailContacts,
  emailContactStatus,
} from "./db";
import { parseEmailSegmentDefinition } from "./segment-schema";
import { parseEmailCampaignContent, type EmailCampaignContent } from "./content-schema";
import { renderEmailHtml } from "./render-email";
export { transitionEmailCampaignStatus, type EmailCampaignStatus } from "./campaign-state";

export type EmailContactStatus = (typeof emailContactStatus.enumValues)[number];
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type EmailContact = typeof emailContacts.$inferSelect;
export type { EmailSegmentDefinition } from "./segment-schema";

export type EventAttendeeContactInput = {
  organizationId: string;
  eventId: string;
  attendeeId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  company?: string | null;
  marketingAcceptedAt?: Date | string | null;
  attributes?: Record<string, unknown>;
};

const emailSchema = z.string().trim().toLowerCase().max(320).email();

export function normalizeContactEmail(email: string): string {
  return emailSchema.parse(email);
}

export function resolveInitialContactStatus(
  marketingAcceptedAt: Date | string | null | undefined,
): EmailContactStatus {
  return marketingAcceptedAt ? "subscribed" : "pending";
}

export function preserveContactStatus(
  currentStatus: EmailContactStatus,
  marketingAcceptedAt: Date | string | null | undefined,
): EmailContactStatus {
  if (currentStatus === "unsubscribed" || currentStatus === "suppressed") {
    return currentStatus;
  }

  return marketingAcceptedAt ? "subscribed" : currentStatus;
}

export async function syncEventAttendeeContact(
  input: EventAttendeeContactInput,
): Promise<{ contactId: string }> {
  const emailNormalized = normalizeContactEmail(input.email);
  const requestedStatus = resolveInitialContactStatus(input.marketingAcceptedAt);
  const now = new Date();

  const [contact] = await db
    .insert(emailContacts)
    .values({
      organizationId: input.organizationId,
      email: input.email.trim(),
      emailNormalized,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      attributes: input.attributes ?? {},
      subscriptionStatus: requestedStatus,
      consentSource: input.marketingAcceptedAt ? "event_registration" : null,
      consentedAt: input.marketingAcceptedAt ? new Date(input.marketingAcceptedAt) : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [emailContacts.organizationId, emailContacts.emailNormalized],
      set: {
        email: input.email.trim(),
        fullName: input.fullName.trim(),
        phone: input.phone?.trim() || null,
        company: input.company?.trim() || null,
        attributes: input.attributes ?? {},
        subscriptionStatus: sql`CASE
          WHEN ${emailContacts.subscriptionStatus} IN ('unsubscribed', 'suppressed')
            THEN ${emailContacts.subscriptionStatus}
          WHEN ${emailContacts.subscriptionStatus} = 'subscribed'
            THEN ${emailContacts.subscriptionStatus}
          ELSE ${requestedStatus}
        END`,
        consentSource: input.marketingAcceptedAt ? "event_registration" : undefined,
        consentedAt: input.marketingAcceptedAt ? new Date(input.marketingAcceptedAt) : undefined,
        updatedAt: now,
      },
    })
    .returning({ id: emailContacts.id });

  if (!contact) {
    throw new Error("Could not persist email marketing contact.");
  }

  await db
    .insert(emailContactEvents)
    .values({
      organizationId: input.organizationId,
      contactId: contact.id,
      eventId: input.eventId,
      attendeeId: input.attendeeId,
      attributesSnapshot: input.attributes ?? {},
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [
        emailContactEvents.organizationId,
        emailContactEvents.contactId,
        emailContactEvents.eventId,
      ],
      set: {
        attendeeId: input.attendeeId,
        attributesSnapshot: input.attributes ?? {},
        lastSeenAt: now,
      },
    });

  return { contactId: contact.id };
}

export async function listEmailCampaigns(organizationId: string): Promise<EmailCampaign[]> {
  return db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.organizationId, organizationId))
    .orderBy(desc(emailCampaigns.createdAt));
}

export async function listEmailContacts(organizationId: string): Promise<EmailContact[]> {
  return db
    .select()
    .from(emailContacts)
    .where(eq(emailContacts.organizationId, organizationId))
    .orderBy(desc(emailContacts.updatedAt))
    .limit(100);
}

export type CreateEmailCampaignInput = {
  organizationId: string;
  createdBy: string;
  name: string;
  subject: string;
  content: EmailCampaignContent;
  htmlSnapshot: string;
};

export async function createEmailCampaign(input: CreateEmailCampaignInput): Promise<EmailCampaign> {
  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      name: input.name,
      subject: input.subject,
      content: input.content,
      htmlSnapshot: input.htmlSnapshot,
    })
    .returning();

  if (!campaign) throw new Error("Email campaign could not be created.");
  return campaign;
}

export { parseEmailSegmentDefinition };
export { parseEmailCampaignContent, renderEmailHtml };
