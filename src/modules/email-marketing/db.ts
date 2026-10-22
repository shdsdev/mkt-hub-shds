import {
  jsonb,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "@/modules/users/db";
import { users } from "@/modules/users/db";
import type { EmailSegmentDefinition } from "./segment-schema";
import type { EmailContentDocument } from "./content-schema";

export const emailContactStatus = pgEnum("email_contact_status", [
  "subscribed",
  "unsubscribed",
  "suppressed",
  "pending",
]);

export const emailTemplateStatus = pgEnum("email_template_status", ["draft", "published", "archived"]);
export const emailCampaignStatus = pgEnum("email_campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
  "failed",
]);
export const emailRecipientStatus = pgEnum("email_recipient_status", [
  "pending",
  "sent",
  "delivered",
  "bounced",
  "failed",
  "suppressed",
]);

export const emailContacts = pgTable(
  "email_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    fullName: text("full_name"),
    phone: text("phone"),
    company: text("company"),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    subscriptionStatus: emailContactStatus("subscription_status").notNull().default("pending"),
    consentSource: text("consent_source"),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("email_contacts_organization_email_unique").on(
      table.organizationId,
      table.emailNormalized,
    ),
  ],
);

export const emailContactEvents = pgTable(
  "email_contact_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => emailContacts.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull(),
    attendeeId: uuid("attendee_id").notNull(),
    attributesSnapshot: jsonb("attributes_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("email_contact_events_organization_contact_event_unique").on(
      table.organizationId,
      table.contactId,
      table.eventId,
    ),
  ],
);

export const emailSegments = pgTable("email_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  definition: jsonb("definition").$type<EmailSegmentDefinition>().notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  status: emailTemplateStatus("status").notNull().default("draft"),
  content: jsonb("content").$type<EmailContentDocument>().notNull(),
  htmlSnapshot: text("html_snapshot").notNull(),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailCampaigns = pgTable("email_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  status: emailCampaignStatus("status").notNull().default("draft"),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  fromName: text("from_name"),
  content: jsonb("content").$type<EmailContentDocument>().notNull(),
  htmlSnapshot: text("html_snapshot").notNull(),
  segmentId: uuid("segment_id").references(() => emailSegments.id),
  eventId: uuid("event_id"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailCampaignRecipients = pgTable(
  "email_campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => emailContacts.id),
    email: text("email").notNull(),
    fullName: text("full_name"),
    personalization: jsonb("personalization").$type<Record<string, string>>().notNull().default({}),
    status: emailRecipientStatus("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [unique("email_campaign_recipients_campaign_contact_unique").on(table.campaignId, table.contactId)],
);

export const emailDeliveryEvents = pgTable(
  "email_delivery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id").references(() => emailCampaignRecipients.id),
    providerEventId: text("provider_event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
);

export const emailMarketingTables = {
  emailContactStatus,
  emailTemplateStatus,
  emailCampaignStatus,
  emailRecipientStatus,
  emailContacts,
  emailContactEvents,
  emailSegments,
  emailTemplates,
  emailCampaigns,
  emailCampaignRecipients,
  emailDeliveryEvents,
} as const;
