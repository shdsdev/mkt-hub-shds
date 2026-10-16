import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { eventAttendees, events } from "@/modules/events/db";
import { organizations, users } from "@/modules/users/db";

export const raffleStatus = pgEnum("raffle_status", ["not_configured", "ready", "active", "finished", "paused"]);
export const raffleWinnerPolicy = pgEnum("raffle_winner_policy", ["include_winners", "exclude_winners"]);
export const rafflePrizeStatus = pgEnum("raffle_prize_status", ["ready", "active", "finished", "paused"]);
export const raffleDrawStatus = pgEnum("raffle_draw_status", ["pending_reveal", "revealed", "claimed", "unclaimed", "invalidated"]);
export const raffleAuditAction = pgEnum("raffle_audit_action", [
  "draw",
  "reveal",
  "claim",
  "invalidate",
  "validate",
  "resend_request",
  "prize_change",
  "status_change",
]);

export const raffles = pgTable(
  "raffles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    status: raffleStatus("status").notNull().default("not_configured"),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("raffles_event_unique").on(table.eventId)],
);

export const rafflePrizes = pgTable("raffle_prizes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  raffleId: uuid("raffle_id").notNull().references(() => raffles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  instructions: text("instructions"),
  claimDeadlineAt: timestamp("claim_deadline_at", { withTimezone: true }),
  fulfillmentContact: text("fulfillment_contact"),
  conditions: text("conditions"),
  winnerPolicy: raffleWinnerPolicy("winner_policy").notNull().default("exclude_winners"),
  drawnQuantity: integer("drawn_quantity").notNull().default(0),
  status: rafflePrizeStatus("status").notNull().default("ready"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("raffle_prizes_quantity_positive", sql`${table.quantity} > 0`),
  check("raffle_prizes_drawn_quantity_valid", sql`${table.drawnQuantity} >= 0 AND ${table.drawnQuantity} <= ${table.quantity}`),
]);

export const raffleDraws = pgTable(
  "raffle_draws",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    raffleId: uuid("raffle_id").notNull().references(() => raffles.id, { onDelete: "cascade" }),
    prizeId: uuid("prize_id").notNull().references(() => rafflePrizes.id),
    eventId: uuid("event_id").notNull().references(() => events.id),
    attendeeId: uuid("attendee_id").notNull().references(() => eventAttendees.id),
    attendeeName: text("attendee_name").notNull(),
    attendeeEmail: text("attendee_email").notNull(),
    attendeeCode: text("attendee_code").notNull(),
    eligibleAttendeeIds: jsonb("eligible_attendee_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    eligibleCount: integer("eligible_count").notNull(),
    status: raffleDrawStatus("status").notNull().default("pending_reveal"),
    drawnAt: timestamp("drawn_at", { withTimezone: true }).notNull().defaultNow(),
    revealedAt: timestamp("revealed_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimedBy: uuid("claimed_by").references(() => users.id),
    claimedByExternal: text("claimed_by_external"),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    invalidatedBy: uuid("invalidated_by").references(() => users.id),
    reason: text("reason"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("raffle_draws_raffle_idempotency_unique").on(table.raffleId, table.idempotencyKey)],
);

export const raffleAudit = pgTable("raffle_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  raffleId: uuid("raffle_id").notNull().references(() => raffles.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").notNull().references(() => events.id),
  prizeId: uuid("prize_id").references(() => rafflePrizes.id),
  drawId: uuid("draw_id").references(() => raffleDraws.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorEmail: text("actor_email").notNull(),
    actorExternalId: text("actor_external_id"),
    actorExternalEmail: text("actor_external_email"),
    actorSource: text("actor_source").notNull().default("hub"),
  action: raffleAuditAction("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RaffleRow = typeof raffles.$inferSelect;
export type RafflePrizeRow = typeof rafflePrizes.$inferSelect;
export type RaffleDrawRow = typeof raffleDraws.$inferSelect;
export type RaffleAuditRow = typeof raffleAudit.$inferSelect;
export type RaffleTables = typeof raffles | typeof rafflePrizes | typeof raffleDraws | typeof raffleAudit;

export const rafflesTables = { raffleStatus, raffleWinnerPolicy, rafflePrizeStatus, raffleDrawStatus, raffleAuditAction, raffles, rafflePrizes, raffleDraws, raffleAudit } as const;
