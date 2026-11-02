import { z } from "zod";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { and, count, desc, eq, gt, ilike, inArray, lte, ne, or } from "drizzle-orm";
import { env } from "@/lib/env";
import { sendViaResend } from "@/modules/notifications";
import {
  emailCampaignRecipients,
  emailCampaigns,
  emailContactTags,
  emailContactEvents,
  emailContacts,
  emailContactStatus,
  emailDeliveryEvents,
  emailRepermissionRequests,
  emailSegments,
  emailTags,
} from "./db";
import { parseEmailSegmentDefinition, type EmailSegmentCondition, type EmailSegmentDefinition } from "./segment-schema";
import { parseEmailCampaignContent, type EmailCampaignContent } from "./content-schema";
import { renderEmailHtml } from "./render-email";
import type { EmailContactListOptions } from "./contact-list-options";
import { resolveCampaignCompletionStatus } from "./campaign-processing";
import { summarizeRecipientStatuses, type EmailCampaignDeliverySummary } from "./delivery-summary";
import { getRecipientDeliveryStatus } from "./delivery-events";
import { createRepermissionToken, hashRepermissionToken, isRepermissionContactEligible, renderRepermissionEmailHtml } from "./repermission";
export { transitionEmailCampaignStatus, type EmailCampaignStatus } from "./campaign-state";

export type EmailContactStatus = (typeof emailContactStatus.enumValues)[number];
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type EmailContact = typeof emailContacts.$inferSelect;
export type { EmailCampaignDeliverySummary } from "./delivery-summary";
export type { EmailSegmentCondition, EmailSegmentDefinition } from "./segment-schema";

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

export function isAdminSubscriptionEligible(status: EmailContactStatus): boolean {
  return status === "pending";
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
      source: "event_registration",
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
        source: "event_registration",
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

export type CreateEmailContactInput = {
  organizationId: string;
  email: string;
  source: string;
  fullName?: string | null;
  phone?: string | null;
  company?: string | null;
  attributes?: Record<string, unknown>;
  subscriptionStatus?: EmailContactStatus;
  consentSource?: string | null;
  consentedAt?: Date | string | null;
  unsubscribedAt?: Date | string | null;
};

export async function createEmailContact(
  input: CreateEmailContactInput,
): Promise<{ contactId: string; created: boolean }> {
  const emailNormalized = normalizeContactEmail(input.email);
  const now = new Date();
  const parsedConsentedAt = input.consentedAt ? new Date(input.consentedAt) : null;
  const hasConsentEvidence = Boolean(
    input.subscriptionStatus === "subscribed" &&
    input.consentSource?.trim() &&
    parsedConsentedAt &&
    !Number.isNaN(parsedConsentedAt.getTime()),
  );
  const requestedStatus: EmailContactStatus = input.subscriptionStatus === "subscribed" && !hasConsentEvidence
    ? "pending"
    : input.subscriptionStatus ?? "pending";
  const parsedUnsubscribedAt = input.unsubscribedAt ? new Date(input.unsubscribedAt) : null;
  const unsubscribedAt = requestedStatus === "unsubscribed"
    ? parsedUnsubscribedAt && !Number.isNaN(parsedUnsubscribedAt.getTime()) ? parsedUnsubscribedAt : now
    : null;
  const [existing] = await db
    .select({ id: emailContacts.id })
    .from(emailContacts)
    .where(and(eq(emailContacts.organizationId, input.organizationId), eq(emailContacts.emailNormalized, emailNormalized)))
    .limit(1);
  const updates = {
    email: input.email.trim(),
    source: input.source.trim() || "manual",
    ...(input.fullName !== undefined ? { fullName: input.fullName?.trim() || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
    ...(input.company !== undefined ? { company: input.company?.trim() || null } : {}),
    ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
    ...(input.subscriptionStatus !== undefined ? {
      subscriptionStatus: sql`CASE
        WHEN ${emailContacts.subscriptionStatus} IN ('unsubscribed', 'suppressed')
          THEN ${emailContacts.subscriptionStatus}
        WHEN ${requestedStatus} IN ('unsubscribed', 'suppressed')
          THEN ${requestedStatus}
        WHEN ${emailContacts.subscriptionStatus} = 'subscribed'
          THEN ${emailContacts.subscriptionStatus}
        ELSE ${requestedStatus}
      END`,
    } : {}),
    ...(hasConsentEvidence ? {
      consentSource: input.consentSource?.trim() || null,
      consentedAt: parsedConsentedAt,
    } : {}),
    ...(requestedStatus === "unsubscribed" ? { unsubscribedAt } : {}),
    updatedAt: now,
  };
  const [contact] = await db
    .insert(emailContacts)
    .values({
      organizationId: input.organizationId,
      email: input.email.trim(),
      emailNormalized,
      source: input.source.trim() || "manual",
      fullName: input.fullName?.trim() || null,
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      attributes: input.attributes ?? {},
      subscriptionStatus: requestedStatus,
      consentSource: hasConsentEvidence ? input.consentSource?.trim() || null : null,
      consentedAt: hasConsentEvidence ? parsedConsentedAt : null,
      unsubscribedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [emailContacts.organizationId, emailContacts.emailNormalized],
      set: updates,
    })
    .returning({ id: emailContacts.id });

  if (!contact) throw new Error("Could not persist email marketing contact.");
  return { contactId: contact.id, created: !existing };
}

export async function listEmailCampaigns(organizationId: string): Promise<EmailCampaign[]> {
  return db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.organizationId, organizationId))
    .orderBy(desc(emailCampaigns.createdAt));
}

export async function getEmailCampaign(input: { organizationId: string; campaignId: string }): Promise<EmailCampaign | undefined> {
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.organizationId, input.organizationId), eq(emailCampaigns.id, input.campaignId)))
    .limit(1);
  return campaign;
}

export async function getEmailCampaignDeliverySummary(input: {
  organizationId: string;
  campaignId: string;
}): Promise<{
  counts: EmailCampaignDeliverySummary;
  failedRecipients: Array<{ email: string; status: "bounced" | "failed" | "suppressed"; error: string | null }>;
  recentEvents: Array<{ eventType: string; occurredAt: Date }>;
}> {
  const statusRows = await db
    .select({ status: emailCampaignRecipients.status, count: count() })
    .from(emailCampaignRecipients)
    .where(and(eq(emailCampaignRecipients.organizationId, input.organizationId), eq(emailCampaignRecipients.campaignId, input.campaignId)))
    .groupBy(emailCampaignRecipients.status);
  const failedRecipients = await db
    .select({ email: emailCampaignRecipients.email, status: emailCampaignRecipients.status, error: emailCampaignRecipients.error })
    .from(emailCampaignRecipients)
    .where(and(
      eq(emailCampaignRecipients.organizationId, input.organizationId),
      eq(emailCampaignRecipients.campaignId, input.campaignId),
      inArray(emailCampaignRecipients.status, ["bounced", "failed", "suppressed"]),
    ))
    .orderBy(desc(emailCampaignRecipients.sentAt))
    .limit(20);
  const recentEvents = await db
    .select({ eventType: emailDeliveryEvents.eventType, occurredAt: emailDeliveryEvents.occurredAt })
    .from(emailDeliveryEvents)
    .where(and(eq(emailDeliveryEvents.organizationId, input.organizationId), eq(emailDeliveryEvents.campaignId, input.campaignId)))
    .orderBy(desc(emailDeliveryEvents.occurredAt))
    .limit(10);
  const eventStatusRows = await db
    .select({ eventType: emailDeliveryEvents.eventType, count: count() })
    .from(emailDeliveryEvents)
    .where(and(eq(emailDeliveryEvents.organizationId, input.organizationId), eq(emailDeliveryEvents.campaignId, input.campaignId)))
    .groupBy(emailDeliveryEvents.eventType);
  const counts = summarizeRecipientStatuses(statusRows.map((row) => ({ status: row.status, count: Number(row.count) })));

  return {
    counts: {
      ...counts,
      delayed: Number(eventStatusRows.find((row) => row.eventType === "email.delivery_delayed")?.count ?? 0),
    },
    failedRecipients: failedRecipients.map((recipient) => ({
      ...recipient,
      status: recipient.status as "bounced" | "failed" | "suppressed",
    })),
    recentEvents,
  };
}

export async function listEmailContacts(
  organizationId: string,
  options: EmailContactListOptions,
): Promise<{ rows: EmailContact[]; total: number; page: number; pageSize: number }> {
  const filters = [eq(emailContacts.organizationId, organizationId)];
  if (options.status) filters.push(eq(emailContacts.subscriptionStatus, options.status));
  if (options.source) filters.push(eq(emailContacts.source, options.source));
  if (options.tagId) {
    const taggedContacts = db
      .select({ contactId: emailContactTags.contactId })
      .from(emailContactTags)
      .where(and(eq(emailContactTags.organizationId, organizationId), eq(emailContactTags.tagId, options.tagId)));
    filters.push(inArray(emailContacts.id, taggedContacts));
  }
  if (options.segmentId) {
    const [segment] = await db
      .select({ definition: emailSegments.definition })
      .from(emailSegments)
      .where(and(eq(emailSegments.id, options.segmentId), eq(emailSegments.organizationId, organizationId)))
      .limit(1);
    const matches = segment ? await listEmailSegmentMatches({ organizationId, definition: segment.definition }) : [];
    filters.push(matches.length ? inArray(emailContacts.id, matches.map((contact) => contact.id)) : sql`false`);
  }
  if (options.search) {
    const pattern = `%${options.search}%`;
    filters.push(or(ilike(emailContacts.email, pattern), ilike(emailContacts.fullName, pattern), ilike(emailContacts.company, pattern))!);
  }
  const where = and(...filters);
  const [{ total }] = await db.select({ total: count() }).from(emailContacts).where(where);
  const totalCount = Number(total);
  const totalPages = Math.max(1, Math.ceil(totalCount / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const orderBy = options.sort === "updated_desc"
    ? desc(emailContacts.updatedAt)
    : sql`CASE WHEN ${emailContacts.fullName} IS NULL OR trim(${emailContacts.fullName}) = '' THEN 1 ELSE 0 END ASC, lower(coalesce(${emailContacts.fullName}, '')) ${options.sort === "name_desc" ? sql`DESC` : sql`ASC`}, lower(${emailContacts.email}) ${options.sort === "name_desc" ? sql`DESC` : sql`ASC`}`;
  const rows = await db
    .select()
    .from(emailContacts)
    .where(where)
    .orderBy(orderBy)
    .limit(options.pageSize)
    .offset((page - 1) * options.pageSize);
  return { rows, total: totalCount, page, pageSize: options.pageSize };
}

export type CreateEmailCampaignInput = {
  organizationId: string;
  createdBy: string;
  name: string;
  subject: string;
  previewText?: string | null;
  fromName?: string | null;
  content: EmailCampaignContent;
  htmlSnapshot: string;
  segmentId?: string;
  eventId?: string;
  status?: "draft" | "scheduled";
  scheduledAt?: Date | null;
};

type SaveEmailCampaignInput = {
  organizationId: string;
  createdBy: string;
  campaignId?: string;
  name: string;
  subject: string;
  previewText?: string | null;
  fromName?: string | null;
  content: EmailCampaignContent;
  htmlSnapshot: string;
  segmentId: string | null;
  scheduledAt: Date | null;
  contacts: EmailContact[];
};

export async function saveEmailCampaignWithSnapshot(input: SaveEmailCampaignInput): Promise<{
  campaign: EmailCampaign;
  recipientCount: number;
}> {
  return db.transaction(async (tx) => {
    let campaign: EmailCampaign | undefined;
    if (input.campaignId) {
      [campaign] = await tx
        .update(emailCampaigns)
        .set({
          name: input.name,
          subject: input.subject,
          previewText: input.previewText?.trim() || null,
          fromName: input.fromName?.trim() || null,
          content: input.content,
          htmlSnapshot: input.htmlSnapshot,
          segmentId: input.segmentId,
          status: "draft",
          scheduledAt: null,
          updatedAt: new Date(),
        })
        .where(and(
          eq(emailCampaigns.organizationId, input.organizationId),
          eq(emailCampaigns.id, input.campaignId),
          eq(emailCampaigns.status, "draft"),
        ))
        .returning();
      if (!campaign) throw new Error("CAMPAIGN_NOT_DRAFT");
    } else {
      [campaign] = await tx
        .insert(emailCampaigns)
        .values({
          organizationId: input.organizationId,
          createdBy: input.createdBy,
          name: input.name,
          previewText: input.previewText?.trim() || null,
          fromName: input.fromName?.trim() || null,
          status: "draft",
          subject: input.subject,
          content: input.content,
          htmlSnapshot: input.htmlSnapshot,
          segmentId: input.segmentId,
          scheduledAt: null,
        })
        .returning();
    }
    if (!campaign) throw new Error("Email campaign could not be created.");
    const savedCampaign = campaign;

    await tx.delete(emailCampaignRecipients).where(and(
      eq(emailCampaignRecipients.organizationId, input.organizationId),
      eq(emailCampaignRecipients.campaignId, savedCampaign.id),
    ));
    if (input.contacts.length > 0) {
      await tx.insert(emailCampaignRecipients).values(input.contacts.map((contact) => ({
        organizationId: input.organizationId,
        campaignId: savedCampaign.id,
        contactId: contact.id,
        email: contact.email,
        fullName: contact.fullName,
        personalization: { first_name: contact.fullName ?? "" },
      })));
    }

    if (input.scheduledAt && input.contacts.length === 0) throw new Error("NO_ELIGIBLE_RECIPIENTS");
    if (input.scheduledAt) {
      [campaign] = await tx
        .update(emailCampaigns)
        .set({ status: "scheduled", scheduledAt: input.scheduledAt, updatedAt: new Date() })
        .where(and(
          eq(emailCampaigns.organizationId, input.organizationId),
          eq(emailCampaigns.id, savedCampaign.id),
          eq(emailCampaigns.status, "draft"),
        ))
        .returning();
      if (!campaign) throw new Error("CAMPAIGN_NOT_DRAFT");
    }
    return { campaign: savedCampaign, recipientCount: input.contacts.length };
  });
}

export async function createEmailCampaign(input: CreateEmailCampaignInput): Promise<EmailCampaign> {
  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      name: input.name,
      previewText: input.previewText?.trim() || null,
      fromName: input.fromName?.trim() || null,
      status: input.status ?? "draft",
      subject: input.subject,
      content: input.content,
      htmlSnapshot: input.htmlSnapshot,
      segmentId: input.segmentId,
      eventId: input.eventId,
      scheduledAt: input.scheduledAt ?? null,
    })
    .returning();

  if (!campaign) throw new Error("Email campaign could not be created.");
  return campaign;
}

export type UpdateEmailCampaignInput = {
  organizationId: string;
  campaignId: string;
  name: string;
  subject: string;
  previewText?: string | null;
  fromName?: string | null;
  content: EmailCampaignContent;
  htmlSnapshot: string;
  segmentId?: string;
  status?: "draft" | "scheduled";
  scheduledAt?: Date | null;
};

export async function updateEmailCampaign(input: UpdateEmailCampaignInput): Promise<EmailCampaign | undefined> {
  const [campaign] = await db
    .update(emailCampaigns)
    .set({
      name: input.name,
      subject: input.subject,
      previewText: input.previewText?.trim() || null,
      fromName: input.fromName?.trim() || null,
      content: input.content,
      htmlSnapshot: input.htmlSnapshot,
      segmentId: input.segmentId,
      status: input.status ?? "draft",
      scheduledAt: input.scheduledAt ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(emailCampaigns.organizationId, input.organizationId), eq(emailCampaigns.id, input.campaignId), eq(emailCampaigns.status, "draft")))
    .returning();
  return campaign;
}

export async function scheduleEmailCampaign(input: {
  organizationId: string;
  campaignId: string;
  scheduledAt: Date;
}): Promise<EmailCampaign | undefined> {
  const [campaign] = await db
    .update(emailCampaigns)
    .set({ status: "scheduled", scheduledAt: input.scheduledAt, updatedAt: new Date() })
    .where(and(
      eq(emailCampaigns.organizationId, input.organizationId),
      eq(emailCampaigns.id, input.campaignId),
      eq(emailCampaigns.status, "draft"),
    ))
    .returning();
  return campaign;
}

export async function duplicateEmailCampaign(input: {
  organizationId: string;
  createdBy: string;
  campaignId: string;
}): Promise<EmailCampaign | undefined> {
  const source = await getEmailCampaign({ organizationId: input.organizationId, campaignId: input.campaignId });
  if (!source) return undefined;

  const [campaign] = await db
    .insert(emailCampaigns)
    .values({
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      name: `Copia de ${source.name}`,
      subject: source.subject,
      previewText: source.previewText,
      fromName: source.fromName,
      content: source.content,
      htmlSnapshot: source.htmlSnapshot,
      segmentId: source.segmentId ?? undefined,
      eventId: source.eventId ?? undefined,
      status: "draft",
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
    })
    .returning();
  return campaign;
}

export async function getEmailContact(input: { organizationId: string; contactId: string }): Promise<EmailContact | undefined> {
  const [contact] = await db
    .select()
    .from(emailContacts)
    .where(and(eq(emailContacts.organizationId, input.organizationId), eq(emailContacts.id, input.contactId)))
    .limit(1);
  return contact;
}

export async function updateEmailContact(input: {
  organizationId: string;
  contactId: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  company?: string | null;
}): Promise<EmailContact | undefined> {
  const emailNormalized = normalizeContactEmail(input.email);
  const [existing] = await db
    .select({ id: emailContacts.id })
    .from(emailContacts)
    .where(and(
      eq(emailContacts.organizationId, input.organizationId),
      eq(emailContacts.emailNormalized, emailNormalized),
      ne(emailContacts.id, input.contactId),
    ))
    .limit(1);
  if (existing) throw new Error("EMAIL_ALREADY_EXISTS");
  const [contact] = await db
    .update(emailContacts)
    .set({
      email: input.email.trim(),
      emailNormalized,
      fullName: input.fullName?.trim() || null,
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(emailContacts.organizationId, input.organizationId), eq(emailContacts.id, input.contactId)))
    .returning();
  return contact;
}

export async function subscribeEmailContacts(input: { organizationId: string; contactIds: string[] }): Promise<number> {
  if (input.contactIds.length === 0) return 0;
  const candidates = await db
    .select({ id: emailContacts.id, status: emailContacts.subscriptionStatus })
    .from(emailContacts)
    .where(and(eq(emailContacts.organizationId, input.organizationId), inArray(emailContacts.id, input.contactIds)));
  const eligibleIds = candidates.filter((contact) => isAdminSubscriptionEligible(contact.status)).map((contact) => contact.id);
  if (eligibleIds.length === 0) return 0;
  const updated = await db
    .update(emailContacts)
    .set({
      subscriptionStatus: "subscribed",
      consentedAt: new Date(),
      consentSource: "bulk_admin_action",
      updatedAt: new Date(),
    })
    .where(and(
      eq(emailContacts.organizationId, input.organizationId),
      inArray(emailContacts.id, eligibleIds),
      eq(emailContacts.subscriptionStatus, "pending"),
    ))
    .returning({ id: emailContacts.id });
  return updated.length;
}

export type EmailContactDetail = {
  tags: EmailTag[];
  events: Array<{ eventId: string; firstSeenAt: Date; lastSeenAt: Date }>;
};

export async function listEmailContactDetails(organizationId: string): Promise<Record<string, EmailContactDetail>> {
  const [tagRows, eventRows] = await Promise.all([
    db
      .select({ contactId: emailContactTags.contactId, tag: emailTags })
      .from(emailContactTags)
      .innerJoin(emailTags, eq(emailTags.id, emailContactTags.tagId))
      .where(eq(emailContactTags.organizationId, organizationId)),
    db
      .select({ contactId: emailContactEvents.contactId, eventId: emailContactEvents.eventId, firstSeenAt: emailContactEvents.firstSeenAt, lastSeenAt: emailContactEvents.lastSeenAt })
      .from(emailContactEvents)
      .where(eq(emailContactEvents.organizationId, organizationId)),
  ]);

  const details: Record<string, EmailContactDetail> = {};
  for (const row of tagRows) {
    const detail = details[row.contactId] ?? { tags: [], events: [] };
    detail.tags.push(row.tag);
    details[row.contactId] = detail;
  }
  for (const row of eventRows) {
    const detail = details[row.contactId] ?? { tags: [], events: [] };
    detail.events.push({ eventId: row.eventId, firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt });
    details[row.contactId] = detail;
  }
  return details;
}

export async function getCampaignRecipientContacts(input: {
  organizationId: string;
  campaignId: string;
  segmentId?: string;
}): Promise<EmailContact[]> {
  let filters: Pick<EmailSegmentDefinition["filters"], "subscriptionStatuses" | "eventIds" | "tags"> | undefined;
  let definition: EmailSegmentDefinition | undefined;
  if (input.segmentId) {
    const [segment] = await db
      .select({ definition: emailSegments.definition })
      .from(emailSegments)
      .where(and(eq(emailSegments.id, input.segmentId), eq(emailSegments.organizationId, input.organizationId)))
      .limit(1);
    if (!segment) throw new Error("Selected email segment was not found.");
    definition = segment.definition;
    filters = {
      subscriptionStatuses: segment.definition.filters.subscriptionStatuses,
      eventIds: segment.definition.filters.eventIds,
      tags: segment.definition.filters.tags,
    };
  }

  const contacts = definition?.filters.conditions?.length
    ? (await listEmailSegmentMatches({ organizationId: input.organizationId, definition })).filter((contact) => contact.subscriptionStatus === "subscribed")
    : await listEligibleAudienceContacts({ organizationId: input.organizationId, filters });
  return contacts;
}

export async function createCampaignRecipientSnapshot(input: {
  organizationId: string;
  campaignId: string;
  segmentId?: string;
}): Promise<number> {
  const contacts = await getCampaignRecipientContacts(input);
  await db.delete(emailCampaignRecipients).where(and(
    eq(emailCampaignRecipients.organizationId, input.organizationId),
    eq(emailCampaignRecipients.campaignId, input.campaignId),
  ));
  if (contacts.length === 0) return 0;
  await db.insert(emailCampaignRecipients).values(contacts.map((contact) => ({
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    contactId: contact.id,
    email: contact.email,
    fullName: contact.fullName,
    personalization: { first_name: contact.fullName ?? "" },
  }))).onConflictDoNothing({ target: [emailCampaignRecipients.campaignId, emailCampaignRecipients.contactId] });
  return contacts.length;
}

export { parseEmailSegmentDefinition };
export { parseEmailCampaignContent, renderEmailHtml };

export function getEligibleAudienceStatuses(
  filters?: Pick<EmailSegmentDefinition["filters"], "subscriptionStatuses">,
): ["subscribed"] | [] {
  if (!filters?.subscriptionStatuses?.length || filters.subscriptionStatuses.includes("subscribed")) {
    return ["subscribed"];
  }
  return [];
}

type UnsubscribeTokenPayload = {
  organizationId: string;
  contactId: string;
};

function unsubscribeKey(): Buffer {
  return createHash("sha256")
    .update(process.env.EMAIL_UNSUBSCRIBE_SECRET ?? env.MARKETING_HUB_SERVER_TOKEN)
    .digest();
}

export type EmailSegment = typeof emailSegments.$inferSelect;

export async function listEmailSegments(organizationId: string): Promise<EmailSegment[]> {
  return db
    .select()
    .from(emailSegments)
    .where(eq(emailSegments.organizationId, organizationId))
    .orderBy(desc(emailSegments.updatedAt));
}

export async function createEmailSegment(input: {
  organizationId: string;
  createdBy: string;
  name: string;
  description?: string | null;
  definition: EmailSegmentDefinition;
}): Promise<EmailSegment> {
  const [segment] = await db
    .insert(emailSegments)
    .values({
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      definition: parseEmailSegmentDefinition(input.definition),
    })
    .returning();
  if (!segment) throw new Error("Email segment could not be created.");
  return segment;
}

export async function updateEmailSegment(input: {
  organizationId: string;
  segmentId: string;
  name: string;
  definition: EmailSegmentDefinition;
}): Promise<EmailSegment> {
  const [segment] = await db
    .update(emailSegments)
    .set({ name: input.name.trim(), definition: parseEmailSegmentDefinition(input.definition), updatedAt: new Date() })
    .where(and(eq(emailSegments.id, input.segmentId), eq(emailSegments.organizationId, input.organizationId)))
    .returning();
  if (!segment) throw new Error("Email segment could not be found.");
  return segment;
}

export async function duplicateEmailSegment(input: {
  organizationId: string;
  createdBy: string;
  segmentId: string;
}): Promise<EmailSegment> {
  const [segment] = await db
    .select()
    .from(emailSegments)
    .where(and(eq(emailSegments.id, input.segmentId), eq(emailSegments.organizationId, input.organizationId)))
    .limit(1);
  if (!segment) throw new Error("Email segment could not be found.");
  return createEmailSegment({
    organizationId: input.organizationId,
    createdBy: input.createdBy,
    name: `${segment.name} (copia)`.slice(0, 120),
    description: segment.description,
    definition: segment.definition,
  });
}

export async function deleteEmailSegment(input: { organizationId: string; segmentId: string }): Promise<void> {
  await db
    .delete(emailSegments)
    .where(and(eq(emailSegments.id, input.segmentId), eq(emailSegments.organizationId, input.organizationId)));
}

export type EmailTag = typeof emailTags.$inferSelect;

export function normalizeEmailTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 80);
}

export async function listEmailTags(organizationId: string): Promise<EmailTag[]> {
  return db
    .select()
    .from(emailTags)
    .where(eq(emailTags.organizationId, organizationId))
    .orderBy(emailTags.name);
}

export async function createEmailTag(input: { organizationId: string; name: string }): Promise<EmailTag> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  const nameNormalized = normalizeEmailTagName(name);
  if (!nameNormalized) throw new Error("Tag name is required.");
  const [tag] = await db
    .insert(emailTags)
    .values({ organizationId: input.organizationId, name, nameNormalized })
    .onConflictDoNothing({ target: [emailTags.organizationId, emailTags.nameNormalized] })
    .returning();
  if (tag) return tag;
  const [existing] = await db
    .select()
    .from(emailTags)
    .where(and(eq(emailTags.organizationId, input.organizationId), eq(emailTags.nameNormalized, nameNormalized)))
    .limit(1);
  if (!existing) throw new Error("Email tag could not be created.");
  return existing;
}

export async function assignEmailTags(input: {
  organizationId: string;
  contactIds: string[];
  tagIds: string[];
}): Promise<void> {
  if (input.contactIds.length === 0 || input.tagIds.length === 0) return;
  await db.insert(emailContactTags).values(
    input.contactIds.flatMap((contactId) => input.tagIds.map((tagId) => ({
      organizationId: input.organizationId,
      contactId,
      tagId,
    }))),
  ).onConflictDoNothing({ target: [emailContactTags.contactId, emailContactTags.tagId] });
}

export async function removeEmailTag(input: { organizationId: string; contactId: string; tagId: string }): Promise<void> {
  await db
    .delete(emailContactTags)
    .where(and(
      eq(emailContactTags.organizationId, input.organizationId),
      eq(emailContactTags.contactId, input.contactId),
      eq(emailContactTags.tagId, input.tagId),
    ));
}

export async function listEligibleAudienceContacts(input: {
  organizationId: string;
  filters?: Pick<EmailSegmentDefinition["filters"], "subscriptionStatuses" | "eventIds" | "tags">;
}): Promise<EmailContact[]> {
  const eligibleStatuses = getEligibleAudienceStatuses(input.filters);
  if (eligibleStatuses.length === 0) return [];
  const conditions = [
    eq(emailContacts.organizationId, input.organizationId),
    inArray(emailContacts.subscriptionStatus, eligibleStatuses),
  ];
  if (input.filters?.eventIds?.length) {
    const eventContacts = db
      .select({ contactId: emailContactEvents.contactId })
      .from(emailContactEvents)
      .where(and(eq(emailContactEvents.organizationId, input.organizationId), inArray(emailContactEvents.eventId, input.filters.eventIds)));
    conditions.push(inArray(emailContacts.id, eventContacts));
  }
  if (input.filters?.tags?.length) {
    const normalizedTags = input.filters.tags.map(normalizeEmailTagName).filter(Boolean);
    const taggedContacts = db
      .select({ contactId: emailContactTags.contactId })
      .from(emailContactTags)
      .innerJoin(emailTags, eq(emailTags.id, emailContactTags.tagId))
      .where(and(eq(emailContactTags.organizationId, input.organizationId), inArray(emailTags.nameNormalized, normalizedTags)));
    conditions.push(inArray(emailContacts.id, taggedContacts));
  }
  return db.select().from(emailContacts).where(and(...conditions)).orderBy(desc(emailContacts.updatedAt));
}

function matchesCondition(condition: EmailSegmentCondition, contact: EmailContact, tags: Set<string>, events: Set<string>): boolean {
  if (condition.field === "tag") {
    const value = normalizeEmailTagName(condition.value);
    return condition.operator === "has" ? tags.has(value) : condition.operator === "not_has" ? !tags.has(value) : false;
  }
  if (condition.field === "event") {
    return condition.operator === "has" ? events.has(condition.value) : condition.operator === "not_has" ? !events.has(condition.value) : false;
  }
  const rawValue = condition.field === "subscriptionStatus" ? contact.subscriptionStatus : condition.field === "fullName" ? contact.fullName ?? "" : condition.field === "email" ? contact.email : contact.company ?? "";
  const current = rawValue.trim().toLowerCase();
  const expected = condition.value.trim().toLowerCase();
  if (condition.operator === "is_empty") return current.length === 0;
  if (condition.operator === "is_not_empty") return current.length > 0;
  if (condition.operator === "contains") return current.includes(expected);
  if (condition.operator === "not_contains") return !current.includes(expected);
  if (condition.operator === "equals") return current === expected;
  if (condition.operator === "not_equals") return current !== expected;
  return false;
}

export async function listEmailSegmentMatches(input: { organizationId: string; definition: EmailSegmentDefinition }): Promise<EmailContact[]> {
  const conditions = input.definition.filters.conditions ?? [];
  if (conditions.length === 0) return listEligibleAudienceContacts({ organizationId: input.organizationId, filters: input.definition.filters });

  const contacts = await db.select().from(emailContacts).where(eq(emailContacts.organizationId, input.organizationId)).orderBy(desc(emailContacts.updatedAt));
  const tagRows = await db.select({ contactId: emailContactTags.contactId, name: emailTags.nameNormalized }).from(emailContactTags).innerJoin(emailTags, eq(emailTags.id, emailContactTags.tagId)).where(eq(emailContactTags.organizationId, input.organizationId));
  const eventRows = await db.select({ contactId: emailContactEvents.contactId, eventId: emailContactEvents.eventId }).from(emailContactEvents).where(eq(emailContactEvents.organizationId, input.organizationId));
  const tagsByContact = new Map<string, Set<string>>();
  const eventsByContact = new Map<string, Set<string>>();
  for (const row of tagRows) tagsByContact.set(row.contactId, new Set([...(tagsByContact.get(row.contactId) ?? []), row.name]));
  for (const row of eventRows) eventsByContact.set(row.contactId, new Set([...(eventsByContact.get(row.contactId) ?? []), row.eventId]));
  return contacts.filter((contact) => {
    const results = conditions.map((condition) => matchesCondition(condition, contact, tagsByContact.get(contact.id) ?? new Set(), eventsByContact.get(contact.id) ?? new Set()));
    return input.definition.filters.logic === "any" ? results.some(Boolean) : results.every(Boolean);
  });
}

export function createUnsubscribeToken(input: UnsubscribeTokenPayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", unsubscribeKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(input), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((value) => value.toString("base64url")).join(".");
}

export function decodeUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
  try {
    const [ivValue, tagValue, encryptedValue] = token.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", unsubscribeKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const payload = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8")) as Partial<UnsubscribeTokenPayload>;
    if (typeof payload.organizationId !== "string" || typeof payload.contactId !== "string") return null;
    return { organizationId: payload.organizationId, contactId: payload.contactId };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(token: string): string {
  return `${env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/$/, "")}/email/unsubscribe/${encodeURIComponent(token)}`;
}

export function buildUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export type EmailRepermissionRequest = typeof emailRepermissionRequests.$inferSelect;

export type EmailRepermissionSendResult =
  | { sent: true; requestId: string }
  | { sent: false; reason: "not_eligible" | "provider_failure"; error?: string };

export function buildRepermissionUrl(token: string, action: "confirm" | "decline"): string {
  return `${env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/$/, "")}/email-marketing/re-permission/${encodeURIComponent(token)}?action=${action}`;
}

export async function sendEmailRepermission(input: {
  organizationId: string;
  contactId: string;
  expiresAt?: Date;
}): Promise<EmailRepermissionSendResult> {
  const [contact] = await db
    .select()
    .from(emailContacts)
    .where(and(eq(emailContacts.id, input.contactId), eq(emailContacts.organizationId, input.organizationId)))
    .limit(1);
  if (!contact || !isRepermissionContactEligible(contact.subscriptionStatus)) return { sent: false, reason: "not_eligible" };

  const now = new Date();
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.update(emailRepermissionRequests)
    .set({ status: "expired" })
    .where(and(
      eq(emailRepermissionRequests.organizationId, input.organizationId),
      eq(emailRepermissionRequests.contactId, input.contactId),
      eq(emailRepermissionRequests.status, "pending"),
    ));

  const token = createRepermissionToken();
  const [request] = await db.insert(emailRepermissionRequests).values({
    organizationId: input.organizationId,
    contactId: input.contactId,
    tokenHash: hashRepermissionToken(token),
    expiresAt,
  }).returning();
  if (!request) throw new Error("Re-permission request could not be created.");

  const appOrigin = env.NEXT_PUBLIC_APP_ORIGIN.replace(/\/$/, "");
  const sent = await sendViaResend({
    to: contact.email,
    subject: "¿Seguimos en contacto?",
    html: renderRepermissionEmailHtml({
      recipientName: contact.fullName,
      confirmUrl: buildRepermissionUrl(token, "confirm"),
      declineUrl: buildRepermissionUrl(token, "decline"),
      logoUrl: `${appOrigin}/logos/shades-de-mexico-white-v2.png`,
    }),
    from: env.RESEND_MARKETING_FROM,
    replyTo: env.RESEND_MARKETING_REPLY_TO || undefined,
  });
  if (!sent.ok) return { sent: false, reason: "provider_failure", error: sent.error };

  await db.update(emailRepermissionRequests)
    .set({ sentAt: new Date() })
    .where(eq(emailRepermissionRequests.id, request.id));
  return { sent: true, requestId: request.id };
}

export async function getEmailRepermissionRequest(token: string): Promise<{
  request: EmailRepermissionRequest;
  contact: EmailContact;
} | undefined> {
  const [request] = await db
    .select()
    .from(emailRepermissionRequests)
    .where(and(eq(emailRepermissionRequests.tokenHash, hashRepermissionToken(token)), eq(emailRepermissionRequests.status, "pending")))
    .limit(1);
  if (!request) return undefined;
  if (request.expiresAt <= new Date()) {
    await db.update(emailRepermissionRequests).set({ status: "expired" }).where(eq(emailRepermissionRequests.id, request.id));
    return undefined;
  }
  const contact = await getEmailContact({ organizationId: request.organizationId, contactId: request.contactId });
  return contact ? { request, contact } : undefined;
}

export async function confirmEmailRepermission(input: {
  token: string;
  responseIp?: string | null;
  responseUserAgent?: string | null;
}): Promise<boolean> {
  const current = await getEmailRepermissionRequest(input.token);
  if (!current || !isRepermissionContactEligible(current.contact.subscriptionStatus)) return false;
  const now = new Date();
  const [request] = await db.update(emailRepermissionRequests).set({
    status: "confirmed",
    confirmedAt: now,
    responseIp: input.responseIp ?? null,
    responseUserAgent: input.responseUserAgent ?? null,
  }).where(and(eq(emailRepermissionRequests.id, current.request.id), eq(emailRepermissionRequests.status, "pending"), gt(emailRepermissionRequests.expiresAt, now))).returning({ id: emailRepermissionRequests.id });
  if (!request) return false;
  const [contact] = await db.update(emailContacts).set({
    subscriptionStatus: "subscribed",
    consentSource: "re_permission",
    consentedAt: now,
    updatedAt: now,
  }).where(and(eq(emailContacts.id, current.contact.id), eq(emailContacts.organizationId, current.request.organizationId), eq(emailContacts.subscriptionStatus, "pending"))).returning({ id: emailContacts.id });
  return Boolean(contact);
}

export async function declineEmailRepermission(input: {
  token: string;
  responseIp?: string | null;
  responseUserAgent?: string | null;
}): Promise<boolean> {
  const current = await getEmailRepermissionRequest(input.token);
  if (!current) return false;
  const now = new Date();
  const [request] = await db.update(emailRepermissionRequests).set({
    status: "declined",
    declinedAt: now,
    responseIp: input.responseIp ?? null,
    responseUserAgent: input.responseUserAgent ?? null,
  }).where(and(eq(emailRepermissionRequests.id, current.request.id), eq(emailRepermissionRequests.status, "pending"), gt(emailRepermissionRequests.expiresAt, now))).returning({ id: emailRepermissionRequests.id });
  if (!request) return false;
  await db.update(emailContacts).set({ subscriptionStatus: "unsubscribed", unsubscribedAt: now, updatedAt: now }).where(and(eq(emailContacts.id, current.contact.id), eq(emailContacts.organizationId, current.request.organizationId), eq(emailContacts.subscriptionStatus, "pending")));
  return true;
}

export async function unsubscribeContact(token: string): Promise<boolean> {
  const payload = decodeUnsubscribeToken(token);
  if (!payload) return false;
  const [contact] = await db
    .update(emailContacts)
    .set({ subscriptionStatus: "unsubscribed", unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(emailContacts.id, payload.contactId), eq(emailContacts.organizationId, payload.organizationId)))
    .returning({ id: emailContacts.id });
  return Boolean(contact);
}

export async function inspectUnsubscribeRequest(token: string): Promise<{ valid: boolean; alreadyUnsubscribed: boolean }> {
  const payload = decodeUnsubscribeToken(token);
  if (!payload) return { valid: false, alreadyUnsubscribed: false };
  const [contact] = await db
    .select({ subscriptionStatus: emailContacts.subscriptionStatus })
    .from(emailContacts)
    .where(and(eq(emailContacts.id, payload.contactId), eq(emailContacts.organizationId, payload.organizationId)))
    .limit(1);
  if (!contact) return { valid: false, alreadyUnsubscribed: false };
  return { valid: true, alreadyUnsubscribed: contact.subscriptionStatus === "unsubscribed" };
}

export async function processUnsubscribeRequest(token: string): Promise<{ valid: boolean; changed: boolean }> {
  const inspection = await inspectUnsubscribeRequest(token);
  if (!inspection.valid || inspection.alreadyUnsubscribed) return { valid: inspection.valid, changed: false };
  return { valid: await unsubscribeContact(token), changed: true };
}

export async function sendEmailCampaignRecipient(recipientId: string): Promise<
  | { sent: true; messageId: string }
  | { sent: false; reason: "not_pending" | "not_eligible" | "provider_failure"; error?: string }
> {
  const [recipient] = await db
    .select()
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.id, recipientId))
    .limit(1);
  if (!recipient || recipient.status !== "pending") return { sent: false, reason: "not_pending" };

  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(and(eq(emailCampaigns.id, recipient.campaignId), eq(emailCampaigns.organizationId, recipient.organizationId)))
    .limit(1);
  if (!campaign) return { sent: false, reason: "not_pending" };

  const [contact] = await db
    .select({ subscriptionStatus: emailContacts.subscriptionStatus })
    .from(emailContacts)
    .where(and(eq(emailContacts.id, recipient.contactId), eq(emailContacts.organizationId, recipient.organizationId)))
    .limit(1);
  if (!contact || contact.subscriptionStatus !== "subscribed") {
    await db.update(emailCampaignRecipients).set({ status: "suppressed", error: "Contact is no longer subscribed." }).where(eq(emailCampaignRecipients.id, recipient.id));
    return { sent: false, reason: "not_eligible" };
  }

  const unsubscribeUrl = buildUnsubscribeUrl(createUnsubscribeToken({
    organizationId: recipient.organizationId,
    contactId: recipient.contactId,
  }));
  const result = await sendViaResend({
    to: recipient.email,
    subject: campaign.subject,
    html: renderEmailHtml(campaign.content, { ...recipient.personalization, unsubscribe_url: unsubscribeUrl }),
    from: env.RESEND_MARKETING_FROM,
    replyTo: env.RESEND_MARKETING_REPLY_TO || undefined,
    headers: buildUnsubscribeHeaders(unsubscribeUrl),
  });
  if (!result.ok) {
    await db.update(emailCampaignRecipients).set({ status: "failed", error: result.error }).where(eq(emailCampaignRecipients.id, recipient.id));
    return { sent: false, reason: "provider_failure", error: result.error };
  }

  await db.update(emailCampaignRecipients).set({
    status: "sent",
    providerMessageId: result.messageId,
    sentAt: new Date(),
    error: null,
  }).where(eq(emailCampaignRecipients.id, recipient.id));
  return { sent: true, messageId: result.messageId };
}

export async function processDueEmailCampaigns(input: { limit?: number; campaignId?: string } = {}): Promise<{
  claimed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date();
  const dueCampaigns = await db
    .select()
    .from(emailCampaigns)
    .where(and(
      eq(emailCampaigns.status, "scheduled"),
      lte(emailCampaigns.scheduledAt, now),
      ...(input.campaignId ? [eq(emailCampaigns.id, input.campaignId)] : []),
    ))
    .limit(input.limit ?? 10);
  let sent = 0;
  let failed = 0;
  let claimed = 0;

  for (const candidate of dueCampaigns) {
    const [campaign] = await db
      .update(emailCampaigns)
      .set({ status: "sending", startedAt: now, updatedAt: now })
      .where(and(eq(emailCampaigns.id, candidate.id), eq(emailCampaigns.status, "scheduled")))
      .returning();
    if (!campaign) continue;
    claimed += 1;

    const recipients = await db
      .select({ id: emailCampaignRecipients.id })
      .from(emailCampaignRecipients)
      .where(and(eq(emailCampaignRecipients.campaignId, campaign.id), eq(emailCampaignRecipients.status, "pending")));
    const outcomes: Array<"sent" | "failed"> = [];
    try {
      for (let index = 0; index < recipients.length; index += 5) {
        const batch = recipients.slice(index, index + 5);
        const batchOutcomes = await Promise.all(batch.map(async (recipient) => {
          const result = await sendEmailCampaignRecipient(recipient.id);
          if (result.sent) sent += 1;
          else failed += 1;
          return result.sent ? "sent" as const : "failed" as const;
        }));
        outcomes.push(...batchOutcomes);
      }
      const status = resolveCampaignCompletionStatus(outcomes);
      await db
        .update(emailCampaigns)
        .set({ status, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(emailCampaigns.id, campaign.id));
    } catch {
      await db
        .update(emailCampaigns)
        .set({ status: "failed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(emailCampaigns.id, campaign.id));
    }
  }

  return { claimed, sent, failed };
}

export type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
};

function getProviderMessageId(data: Record<string, unknown>): string | null {
  const value = data.email_id ?? data.id;
  return typeof value === "string" && value ? value : null;
}

export async function processResendWebhookEvent(
  providerEventId: string,
  event: ResendWebhookEvent,
): Promise<"processed" | "duplicate" | "ignored"> {
  const data = event.data ?? {};
  const providerMessageId = getProviderMessageId(data);
  if (!providerMessageId) return "ignored";

  const [recipient] = await db
    .select({
      recipientId: emailCampaignRecipients.id,
      organizationId: emailCampaignRecipients.organizationId,
      campaignId: emailCampaignRecipients.campaignId,
      contactId: emailCampaignRecipients.contactId,
    })
    .from(emailCampaignRecipients)
    .where(eq(emailCampaignRecipients.providerMessageId, providerMessageId))
    .limit(1);
  if (!recipient) return "ignored";

  const [stored] = await db
    .insert(emailDeliveryEvents)
    .values({
      organizationId: recipient.organizationId,
      campaignId: recipient.campaignId,
      recipientId: recipient.recipientId,
      providerEventId,
      eventType: event.type,
      payload: event.data ?? {},
      occurredAt: event.created_at ? new Date(event.created_at) : new Date(),
    })
    .onConflictDoNothing({ target: emailDeliveryEvents.providerEventId })
    .returning({ id: emailDeliveryEvents.id });
  if (!stored) return "duplicate";

  const status = getRecipientDeliveryStatus(event.type);
  if (!status) return "processed";

  await db
    .update(emailCampaignRecipients)
    .set({ status, deliveredAt: status === "delivered" ? new Date() : undefined })
    .where(eq(emailCampaignRecipients.id, recipient.recipientId));

  if (status === "suppressed") {
    await db
      .update(emailContacts)
      .set({ subscriptionStatus: "suppressed", updatedAt: new Date() })
      .where(eq(emailContacts.id, recipient.contactId));
  }

  return "processed";
}
