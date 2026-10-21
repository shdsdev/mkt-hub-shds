import { randomInt } from "node:crypto";
import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { eventAttendees, eventRegistrations, events } from "@/modules/events";
import { sendRaffleWinnerEmail } from "@/modules/notifications";
import {
  raffleAudit,
  raffleDraws,
  rafflePrizes,
  raffles,
  type RaffleAuditRow,
  type RaffleDrawRow,
  type RafflePrizeRow,
  type RaffleRow,
} from "./db";
import { createRaffleStageToken, hashRaffleStageToken } from "./tokens";
import { normalizeRaffleStageTheme } from "./stage-theme";

type RaffleClient = Pick<typeof db, "select" | "insert" | "update" | "execute">;

export type RandomInt = (max: number) => number;
export type RaffleActor =
  | { type?: "hub"; userId: string; email: string }
  | { type: "hcs"; actorId: string; email: string; name: string; source: "hcs" };
export type RaffleFilters = {
  occupation?: string;
  clientBrands?: string[];
  interests?: string[];
};
export type RaffleDrawMode = "manual" | "automatic";

const filtersSchema = z.object({
  occupation: z.string().trim().min(1).optional(),
  clientBrands: z.array(z.string().trim().min(1)).optional(),
  interests: z.array(z.string().trim().min(1)).optional(),
});

export function isClaimDeadlinePassed(deadline: Date | null, now: Date): boolean {
  return deadline !== null && now.getTime() >= deadline.getTime();
}

export function isDrawStatusTransitionAllowed(from: string, to: string): boolean {
  return (from === "pending_reveal" && to === "revealed") ||
    (from === "revealed" && (to === "claimed" || to === "unclaimed")) ||
    ((from === "pending_reveal" || from === "revealed" || from === "claimed" || from === "unclaimed") && to === "invalidated");
}

export function releasesPrizeUnit(status: string): boolean {
  return status === "pending_reveal" || status === "revealed" || status === "claimed";
}

export function getPrizeStatusAfterReleasedUnit(status: string, remainingDrawnQuantity: number): "ready" | "active" | "paused" {
  if (status === "paused") return "paused";
  return remainingDrawnQuantity > 0 ? "active" : "ready";
}

export function getPrizeQuantityAfterDecrease(quantity: number, drawnQuantity: number, amount: number): number {
  if (!Number.isInteger(amount) || amount < 1) throw new Error("Quantity decrease must be positive");
  const nextQuantity = quantity - amount;
  if (nextQuantity < drawnQuantity) throw new Error("Prize quantity cannot be lower than drawn units");
  if (nextQuantity < 1) throw new Error("Prize quantity must be positive");
  return nextQuantity;
}

export function selectEligibleWinners<T extends { id: string }>(
  eligible: T[],
  winnerPolicy: "include_winners" | "exclude_winners",
  prizeId: string,
  prior: Array<{ prizeId: string; attendeeId: string; status: string }>,
): T[] {
  if (winnerPolicy === "include_winners") return eligible;
  const excluded = new Set(
    prior
      .filter((draw) => draw.prizeId === prizeId && draw.status !== "invalidated")
      .map((draw) => draw.attendeeId),
  );
  return eligible.filter((attendee) => !excluded.has(attendee.id));
}

export function getRaffleLifecycleStatus(input: {
  currentStatus: "not_configured" | "ready" | "active" | "finished" | "paused";
  prizes: Array<{ quantity: number; drawnQuantity: number; status: string }>;
  hasDraws: boolean;
}): "not_configured" | "ready" | "active" | "finished" | "paused" {
  if (input.currentStatus === "paused") return "paused";
  if (input.prizes.length === 0) return "not_configured";
  if (input.prizes.every((prize) => prize.drawnQuantity >= prize.quantity)) return "finished";
  return input.hasDraws ? "active" : "ready";
}

async function getEventScope(eventId: string, organizationId: string) {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organizationId, organizationId)))
    .limit(1);
  return rows[0];
}

export async function getRaffleForEvent(eventId: string, organizationId: string): Promise<RaffleRow | undefined> {
  const rows = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.eventId, eventId), eq(raffles.organizationId, organizationId)))
    .limit(1);
  return rows[0];
}

export async function rotateRaffleStageToken(eventId: string, organizationId: string): Promise<{ raffle: RaffleRow; token: string }> {
  const token = createRaffleStageToken();
  const [raffle] = await db
    .update(raffles)
    .set({ stageTokenHash: hashRaffleStageToken(token), updatedAt: new Date() })
    .where(and(eq(raffles.eventId, eventId), eq(raffles.organizationId, organizationId)))
    .returning();
  if (!raffle) throw new Error("Raffle not found");
  return { raffle, token };
}

export async function updateRaffleStageTheme(input: {
  eventId: string;
  raffleId: string;
  organizationId: string;
  stageBackgroundColor: string;
  stageAccentColor: string;
  stageLogoUrl?: string | null;
}): Promise<RaffleRow> {
  const theme = normalizeRaffleStageTheme(input);
  const [raffle] = await db
    .update(raffles)
    .set({
      stageBackgroundColor: theme.backgroundColor,
      stageAccentColor: theme.accentColor,
      stageLogoUrl: theme.logoUrl,
      updatedAt: new Date(),
    })
    .where(and(eq(raffles.id, input.raffleId), eq(raffles.eventId, input.eventId), eq(raffles.organizationId, input.organizationId)))
    .returning();
  if (!raffle) throw new Error("Raffle not found");
  return raffle;
}

export async function getRaffleForStageToken(eventId: string, token: string): Promise<RaffleRow | undefined> {
  const rows = await db
    .select()
    .from(raffles)
    .where(and(eq(raffles.eventId, eventId), eq(raffles.stageTokenHash, hashRaffleStageToken(token))))
    .limit(1);
  return rows[0];
}

export type RaffleStageState = {
  event: { id: string; name: string };
  prizes: Array<{ id: string; name: string; quantity: number; drawnQuantity: number; status: string }>;
  draw: { id: string; prizeId: string; status: string; attendeeName: string; attendeeCompany: string | null; attendeeCode: string; drawnAt: Date } | null;
  theme: ReturnType<typeof normalizeRaffleStageTheme>;
};

export async function getRaffleStageState(eventId: string, token: string): Promise<RaffleStageState | undefined> {
  const raffle = await getRaffleForStageToken(eventId, token);
  if (!raffle) return undefined;
  const [event] = await db.select({ id: events.id, name: events.name }).from(events).where(and(eq(events.id, eventId), eq(events.organizationId, raffle.organizationId))).limit(1);
  if (!event) return undefined;
  const prizes = await db.select({ id: rafflePrizes.id, name: rafflePrizes.name, quantity: rafflePrizes.quantity, drawnQuantity: rafflePrizes.drawnQuantity, status: rafflePrizes.status }).from(rafflePrizes).where(eq(rafflePrizes.raffleId, raffle.id)).orderBy(asc(rafflePrizes.createdAt));
  const draws = await db.select({ id: raffleDraws.id, prizeId: raffleDraws.prizeId, status: raffleDraws.status, attendeeName: raffleDraws.attendeeName, attendeeCompany: raffleDraws.attendeeCompany, attendeeCode: raffleDraws.attendeeCode, drawnAt: raffleDraws.drawnAt }).from(raffleDraws).where(and(eq(raffleDraws.raffleId, raffle.id), ne(raffleDraws.status, "invalidated"))).orderBy(asc(raffleDraws.drawnAt));
  return {
    event,
    prizes,
    draw: draws.at(-1) ?? null,
    theme: normalizeRaffleStageTheme(raffle),
  };
}

export function selectNextRafflePrize<T extends { status: string; drawnQuantity: number; quantity: number }>(prizes: T[]): T | undefined {
  return prizes.find((item) => item.status !== "paused" && item.status !== "finished" && item.drawnQuantity < item.quantity);
}

export async function updateRaffleDrawMode(input: {
  eventId: string;
  raffleId: string;
  organizationId: string;
  drawMode: RaffleDrawMode;
  actor: RaffleActor;
}): Promise<RaffleRow> {
  return db.transaction(async (tx) => {
    const raffle = await getScopedRaffleWithClient(tx, input.raffleId, input.organizationId);
    if (!raffle || raffle.eventId !== input.eventId) throw new Error("Raffle not found");
    await tx.execute(sql`SELECT ${raffles.id} FROM ${raffles} WHERE ${raffles.id} = ${raffle.id} FOR UPDATE`);
    const [updated] = await tx.update(raffles).set({ drawMode: input.drawMode, updatedAt: new Date() }).where(and(eq(raffles.id, raffle.id), eq(raffles.drawMode, raffle.drawMode))).returning();
    if (!updated) throw new Error("Raffle changed concurrently");
    await insertAudit(tx, {
      organizationId: input.organizationId,
      raffleId: raffle.id,
      eventId: raffle.eventId,
      actor: input.actor,
      action: "status_change",
      metadata: { change: "draw_mode", drawMode: input.drawMode },
    });
    return updated;
  });
}

export async function drawNextRafflePrize(input: {
  eventId: string;
  organizationId: string;
  actor: RaffleActor;
  idempotencyKey: string;
}): Promise<RaffleDrawRow> {
  const raffle = await getRaffleForEvent(input.eventId, input.organizationId);
  if (!raffle) throw new Error("Raffle not found");
  const prizes = await db.select().from(rafflePrizes).where(eq(rafflePrizes.raffleId, raffle.id)).orderBy(asc(rafflePrizes.createdAt));
  const [latest] = await db.select().from(raffleDraws).where(and(eq(raffleDraws.raffleId, raffle.id), ne(raffleDraws.status, "invalidated"))).orderBy(sql`${raffleDraws.drawnAt} desc`).limit(1);
  if (latest && (latest.status === "pending_reveal" || latest.status === "revealed")) throw new Error("Previous draw must be confirmed");
  const prize = selectNextRafflePrize(prizes);
  if (!prize) throw new Error("No prizes available");
  return drawPrizeUnit({ eventId: input.eventId, organizationId: input.organizationId, prizeId: prize.id, actor: input.actor, idempotencyKey: input.idempotencyKey, requiredDrawMode: "automatic" });
}

export async function getOrCreateRaffle(eventId: string, organizationId: string, actorUserId: string): Promise<RaffleRow> {
  if (!(await getEventScope(eventId, organizationId))) throw new Error("Event not found");
  const created = await db
    .insert(raffles)
    .values({ eventId, organizationId, createdBy: actorUserId })
    .onConflictDoNothing({ target: raffles.eventId })
    .returning();
  if (created[0]) return created[0];
  const existing = await getRaffleForEvent(eventId, organizationId);
  if (!existing) throw new Error("Raffle could not be created");
  return existing;
}

async function getScopedRaffleWithClient(client: RaffleClient, raffleId: string, organizationId: string) {
  const rows = await client.select().from(raffles).where(and(eq(raffles.id, raffleId), eq(raffles.organizationId, organizationId))).limit(1);
  return rows[0];
}

async function insertAudit(client: RaffleClient, input: {
  organizationId: string;
  raffleId: string;
  eventId: string;
  prizeId?: string;
  drawId?: string;
  actor: RaffleActor;
  action: "draw" | "reveal" | "claim" | "invalidate" | "validate" | "resend_request" | "prize_change" | "status_change";
  metadata: Record<string, unknown>;
}) {
  await client.insert(raffleAudit).values({
    organizationId: input.organizationId,
    raffleId: input.raffleId,
    eventId: input.eventId,
    prizeId: input.prizeId,
    drawId: input.drawId,
    actorUserId: input.actor.type === "hcs" ? null : input.actor.userId,
    actorEmail: input.actor.email,
    actorExternalId: input.actor.type === "hcs" ? input.actor.actorId : null,
    actorExternalEmail: input.actor.type === "hcs" ? input.actor.email : null,
    actorSource: input.actor.type === "hcs" ? input.actor.source : "hub",
    action: input.action,
    metadata: input.metadata,
  });
}

async function lockRaffleAndPrize(client: RaffleClient, raffleId: string, prizeId: string) {
  await client.execute(sql`SELECT ${raffles.id} FROM ${raffles} WHERE ${raffles.id} = ${raffleId} FOR UPDATE`);
  await client.execute(sql`SELECT ${rafflePrizes.id} FROM ${rafflePrizes} WHERE ${rafflePrizes.id} = ${prizeId} FOR UPDATE`);
}

async function refreshRaffleStatus(client: RaffleClient, input: {
  raffle: RaffleRow;
  organizationId: string;
  actor: RaffleActor;
}) {
  const prizes = await client.select().from(rafflePrizes).where(eq(rafflePrizes.raffleId, input.raffle.id));
  const draws = await client.select({ id: raffleDraws.id }).from(raffleDraws).where(eq(raffleDraws.raffleId, input.raffle.id)).limit(1);
  const nextStatus = getRaffleLifecycleStatus({
    currentStatus: input.raffle.status,
    prizes,
    hasDraws: draws.length > 0,
  });
  if (nextStatus === input.raffle.status) return input.raffle.status;
  const [updated] = await client
    .update(raffles)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(raffles.id, input.raffle.id), eq(raffles.status, input.raffle.status)))
    .returning({ status: raffles.status });
  if (!updated) return input.raffle.status;
  await insertAudit(client, {
    organizationId: input.organizationId,
    raffleId: input.raffle.id,
    eventId: input.raffle.eventId,
    actor: input.actor,
    action: "status_change",
    metadata: { status: nextStatus },
  });
  return updated.status;
}

export async function createPrize(input: {
  raffleId: string;
  organizationId: string;
  actorUserId: string;
  actorEmail: string;
  name: string;
  quantity: number;
  instructions?: string | null;
  claimDeadlineAt?: Date | null;
  fulfillmentContact?: string | null;
  conditions?: string | null;
  winnerPolicy?: "include_winners" | "exclude_winners";
}): Promise<RafflePrizeRow> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Prize quantity must be positive");
  return db.transaction(async (tx) => {
    const raffle = await getScopedRaffleWithClient(tx, input.raffleId, input.organizationId);
    if (!raffle) throw new Error("Raffle not found");
    await tx.execute(sql`SELECT ${raffles.id} FROM ${raffles} WHERE ${raffles.id} = ${raffle.id} FOR UPDATE`);
    const [prize] = await tx.insert(rafflePrizes).values({
      raffleId: input.raffleId,
      organizationId: input.organizationId,
      createdBy: input.actorUserId,
      name: input.name,
      quantity: input.quantity,
      instructions: input.instructions,
      claimDeadlineAt: input.claimDeadlineAt,
      fulfillmentContact: input.fulfillmentContact,
      conditions: input.conditions,
      winnerPolicy: input.winnerPolicy,
      status: "ready",
    }).returning();
    const actor = { userId: input.actorUserId, email: input.actorEmail };
    await insertAudit(tx, { organizationId: input.organizationId, raffleId: raffle.id, eventId: raffle.eventId, prizeId: prize.id, actor, action: "prize_change", metadata: { change: "created" } });
    await refreshRaffleStatus(tx, { raffle, organizationId: input.organizationId, actor });
    return prize;
  });
}

export async function updatePrize(input: {
  prizeId: string;
  raffleId: string;
  organizationId: string;
  actorUserId: string;
  actorEmail: string;
  changes: Partial<Pick<RafflePrizeRow, "name" | "instructions" | "claimDeadlineAt" | "fulfillmentContact" | "conditions" | "winnerPolicy" | "status">>;
}): Promise<RafflePrizeRow> {
  return db.transaction(async (tx) => {
    const raffle = await getScopedRaffleWithClient(tx, input.raffleId, input.organizationId);
    if (!raffle) throw new Error("Raffle not found");
    await lockRaffleAndPrize(tx, raffle.id, input.prizeId);
    const [prize] = await tx.select().from(rafflePrizes).where(and(eq(rafflePrizes.id, input.prizeId), eq(rafflePrizes.raffleId, input.raffleId), eq(rafflePrizes.organizationId, input.organizationId))).limit(1);
    if (!prize) throw new Error("Prize not found");
    const [updated] = await tx.update(rafflePrizes).set({ ...input.changes, updatedAt: new Date() }).where(and(eq(rafflePrizes.id, prize.id), eq(rafflePrizes.status, prize.status))).returning();
    if (!updated) throw new Error("Prize changed concurrently");
    const actor = { userId: input.actorUserId, email: input.actorEmail };
    await insertAudit(tx, { organizationId: input.organizationId, raffleId: raffle.id, eventId: raffle.eventId, prizeId: prize.id, actor, action: input.changes.status ? "status_change" : "prize_change", metadata: input.changes });
    return updated;
  });
}

export async function increasePrizeQuantity(input: { prizeId: string; raffleId: string; organizationId: string; actorUserId: string; actorEmail: string; amount: number }): Promise<RafflePrizeRow> {
  if (!Number.isInteger(input.amount) || input.amount < 1) throw new Error("Quantity increase must be positive");
  return db.transaction(async (tx) => {
    const raffle = await getScopedRaffleWithClient(tx, input.raffleId, input.organizationId);
    if (!raffle) throw new Error("Raffle not found");
    await lockRaffleAndPrize(tx, raffle.id, input.prizeId);
    const [current] = await tx.select().from(rafflePrizes).where(and(eq(rafflePrizes.id, input.prizeId), eq(rafflePrizes.raffleId, input.raffleId), eq(rafflePrizes.organizationId, input.organizationId))).limit(1);
    if (!current) throw new Error("Prize not found");
    const [prize] = await tx.update(rafflePrizes).set({
      quantity: sql`${rafflePrizes.quantity} + ${input.amount}`,
      status: sql`CASE WHEN ${rafflePrizes.status} = 'paused'::raffle_prize_status THEN 'paused'::raffle_prize_status WHEN ${rafflePrizes.drawnQuantity} >= ${rafflePrizes.quantity} + ${input.amount} THEN 'finished'::raffle_prize_status ELSE 'active'::raffle_prize_status END`,
      updatedAt: new Date(),
    }).where(and(eq(rafflePrizes.id, current.id), eq(rafflePrizes.status, current.status))).returning();
    if (!prize) throw new Error("Prize changed concurrently");
    const actor = { userId: input.actorUserId, email: input.actorEmail };
    await insertAudit(tx, { organizationId: input.organizationId, raffleId: raffle.id, eventId: raffle.eventId, prizeId: prize.id, actor, action: "prize_change", metadata: { change: "quantity_increased", amount: input.amount } });
    await refreshRaffleStatus(tx, { raffle, organizationId: input.organizationId, actor });
    return prize;
  });
}

export async function decreasePrizeQuantity(input: { prizeId: string; raffleId: string; organizationId: string; actorUserId: string; actorEmail: string; amount: number }): Promise<RafflePrizeRow> {
  if (!Number.isInteger(input.amount) || input.amount < 1) throw new Error("Quantity decrease must be positive");
  return db.transaction(async (tx) => {
    const raffle = await getScopedRaffleWithClient(tx, input.raffleId, input.organizationId);
    if (!raffle) throw new Error("Raffle not found");
    await lockRaffleAndPrize(tx, raffle.id, input.prizeId);
    const [current] = await tx.select().from(rafflePrizes).where(and(eq(rafflePrizes.id, input.prizeId), eq(rafflePrizes.raffleId, input.raffleId), eq(rafflePrizes.organizationId, input.organizationId))).limit(1);
    if (!current) throw new Error("Prize not found");
    const nextQuantity = getPrizeQuantityAfterDecrease(current.quantity, current.drawnQuantity, input.amount);
    const [prize] = await tx.update(rafflePrizes).set({
      quantity: nextQuantity,
      status: sql`CASE WHEN ${rafflePrizes.status} = 'paused'::raffle_prize_status THEN 'paused'::raffle_prize_status WHEN ${rafflePrizes.drawnQuantity} >= ${nextQuantity} THEN 'finished'::raffle_prize_status ELSE 'active'::raffle_prize_status END`,
      updatedAt: new Date(),
    }).where(and(eq(rafflePrizes.id, current.id), eq(rafflePrizes.status, current.status), eq(rafflePrizes.quantity, current.quantity))).returning();
    if (!prize) throw new Error("Prize changed concurrently");
    const actor = { userId: input.actorUserId, email: input.actorEmail };
    await insertAudit(tx, { organizationId: input.organizationId, raffleId: raffle.id, eventId: raffle.eventId, prizeId: prize.id, actor, action: "prize_change", metadata: { change: "quantity_decreased", amount: input.amount } });
    await refreshRaffleStatus(tx, { raffle, organizationId: input.organizationId, actor });
    return prize;
  });
}

export type EligibleAttendee = {
  id: string;
  fullName: string;
  email: string;
  backupCode: string;
  occupation: string | null;
  company: string | null;
};

async function listEligibleAttendeesWithClient(client: RaffleClient, input: { eventId: string; organizationId: string; filters?: RaffleFilters }): Promise<EligibleAttendee[]> {
  const filters = filtersSchema.parse(input.filters ?? {});
  const conditions = [
    eq(eventAttendees.eventId, input.eventId),
    eq(eventAttendees.organizationId, input.organizationId),
    isNotNull(eventAttendees.checkedInAt),
    eq(eventAttendees.isActive, true),
    ne(eventRegistrations.status, "cancelled"),
    ne(eventRegistrations.status, "waitlisted"),
  ];
  if (filters.occupation) conditions.push(eq(eventAttendees.occupation, filters.occupation));
  if (filters.clientBrands?.length) conditions.push(sql`${eventRegistrations.clientBrands} @> ${JSON.stringify(filters.clientBrands)}::jsonb`);
  if (filters.interests?.length) conditions.push(sql`${eventRegistrations.interests} @> ${JSON.stringify(filters.interests)}::jsonb`);
  const rows = await client.select({ attendee: eventAttendees }).from(eventAttendees).innerJoin(eventRegistrations, eq(eventRegistrations.id, eventAttendees.registrationId)).where(and(...conditions)).orderBy(asc(eventAttendees.id));
  return rows.map(({ attendee }) => ({ id: attendee.id, fullName: attendee.fullName, email: attendee.email, backupCode: attendee.backupCode, occupation: attendee.occupation, company: attendee.company }));
}

export async function listEligibleAttendees(input: { eventId: string; organizationId: string; filters?: RaffleFilters }): Promise<EligibleAttendee[]> {
  return listEligibleAttendeesWithClient(db, input);
}

export async function drawPrizeUnit(input: {
  eventId: string;
  organizationId: string;
  prizeId: string;
  actor: RaffleActor;
  idempotencyKey: string;
  filters?: RaffleFilters;
  requiredDrawMode?: RaffleDrawMode;
  rng?: RandomInt;
}): Promise<RaffleDrawRow> {
  const rng = input.rng ?? randomInt;
  return db.transaction(async (tx) => {
    const scopedRows = await tx.select({ prize: rafflePrizes, raffle: raffles }).from(rafflePrizes).innerJoin(raffles, eq(raffles.id, rafflePrizes.raffleId)).where(and(eq(rafflePrizes.id, input.prizeId), eq(rafflePrizes.organizationId, input.organizationId), eq(raffles.eventId, input.eventId), eq(raffles.organizationId, input.organizationId))).limit(1);
    const scoped = scopedRows[0];
    if (!scoped) throw new Error("Prize not found");
    await lockRaffleAndPrize(tx, scoped.raffle.id, scoped.prize.id);
    const existing = await tx.select().from(raffleDraws).where(and(eq(raffleDraws.raffleId, scoped.raffle.id), eq(raffleDraws.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing[0]) return existing[0];
    const [prize] = await tx.select().from(rafflePrizes).where(eq(rafflePrizes.id, scoped.prize.id)).limit(1);
    const [raffle] = await tx.select().from(raffles).where(eq(raffles.id, scoped.raffle.id)).limit(1);
    if (!prize || !raffle) throw new Error("Prize not found");
    if (input.requiredDrawMode && raffle.drawMode !== input.requiredDrawMode) throw new Error("Draw mode changed. Refresh the raffle panel and try again.");
    if (raffle.status === "paused") throw new Error("Raffle is paused");
    if (prize.status === "paused") throw new Error("Prize is paused");
    if (prize.drawnQuantity >= prize.quantity) throw new Error("Prize is exhausted");
    const allEligible = await listEligibleAttendeesWithClient(tx, { eventId: input.eventId, organizationId: input.organizationId, filters: input.filters });
    const prior = await tx.select({ prizeId: raffleDraws.prizeId, attendeeId: raffleDraws.attendeeId, status: raffleDraws.status }).from(raffleDraws).where(and(eq(raffleDraws.raffleId, raffle.id), ne(raffleDraws.status, "invalidated")));
    const eligible = selectEligibleWinners(allEligible, prize.winnerPolicy, prize.id, prior);
    if (!eligible.length) throw new Error("No eligible attendees");
    const winner = eligible[rng(eligible.length)];
    const [draw] = await tx.insert(raffleDraws).values({
      organizationId: input.organizationId,
      raffleId: raffle.id,
      prizeId: prize.id,
      eventId: input.eventId,
      attendeeId: winner.id,
      attendeeName: winner.fullName,
      attendeeEmail: winner.email,
      attendeeCode: winner.backupCode,
      attendeeCompany: winner.company,
      eligibleAttendeeIds: eligible.map((attendee) => attendee.id),
      eligibleCount: eligible.length,
      idempotencyKey: input.idempotencyKey,
    }).returning();
    const [updatedPrize] = await tx.update(rafflePrizes).set({ drawnQuantity: sql`${rafflePrizes.drawnQuantity} + 1`, status: sql`CASE WHEN ${rafflePrizes.drawnQuantity} + 1 >= ${rafflePrizes.quantity} THEN 'finished'::raffle_prize_status ELSE 'active'::raffle_prize_status END`, updatedAt: new Date() }).where(and(eq(rafflePrizes.id, prize.id), eq(rafflePrizes.status, prize.status), sql`${rafflePrizes.drawnQuantity} < ${rafflePrizes.quantity}`)).returning();
    if (!updatedPrize) throw new Error("Prize was exhausted concurrently");
    await insertAudit(tx, { organizationId: input.organizationId, raffleId: raffle.id, eventId: input.eventId, prizeId: prize.id, drawId: draw.id, actor: input.actor, action: "draw", metadata: { idempotencyKey: input.idempotencyKey, eligibleCount: eligible.length } });
    await refreshRaffleStatus(tx, { raffle, organizationId: input.organizationId, actor: input.actor });
    return draw;
  }, { isolationLevel: "serializable" });
}

async function getScopedDraw(client: RaffleClient, drawId: string, eventId: string, organizationId: string) {
  const rows = await client.select().from(raffleDraws).where(and(eq(raffleDraws.id, drawId), eq(raffleDraws.eventId, eventId), eq(raffleDraws.organizationId, organizationId))).limit(1);
  return rows[0];
}

export async function revealDraw(input: { drawId: string; eventId: string; organizationId: string; actor: RaffleActor }): Promise<RaffleDrawRow> {
  return db.transaction(async (tx) => {
    const initial = await getScopedDraw(tx, input.drawId, input.eventId, input.organizationId);
    if (!initial) throw new Error("Draw not found");
    await tx.execute(sql`SELECT ${raffleDraws.id} FROM ${raffleDraws} WHERE ${raffleDraws.id} = ${initial.id} FOR UPDATE`);
    const draw = await getScopedDraw(tx, input.drawId, input.eventId, input.organizationId);
    if (!draw) throw new Error("Draw not found");
    if (!isDrawStatusTransitionAllowed(draw.status, "revealed")) return draw;
    const [updated] = await tx.update(raffleDraws).set({ status: "revealed", revealedAt: new Date(), updatedAt: new Date() }).where(and(eq(raffleDraws.id, draw.id), eq(raffleDraws.status, "pending_reveal"))).returning();
    if (!updated) throw new Error("Draw changed concurrently");
    await insertAudit(tx, { organizationId: input.organizationId, raffleId: draw.raffleId, eventId: input.eventId, prizeId: draw.prizeId, drawId: draw.id, actor: input.actor, action: "reveal", metadata: {} });
    return updated;
  });
}

export async function invalidateDraw(input: { drawId: string; eventId: string; organizationId: string; actor: RaffleActor; reason: string }): Promise<RaffleDrawRow> {
  return db.transaction(async (tx) => {
    const initial = await getScopedDraw(tx, input.drawId, input.eventId, input.organizationId);
    if (!initial) throw new Error("Draw not found");
    await lockRaffleAndPrize(tx, initial.raffleId, initial.prizeId);
    const draw = await getScopedDraw(tx, input.drawId, input.eventId, input.organizationId);
    if (!draw) throw new Error("Draw not found");
    if (draw.status === "invalidated") return draw;
    const [updated] = await tx.update(raffleDraws).set({ status: "invalidated", invalidatedAt: new Date(), invalidatedBy: input.actor.type === "hcs" ? null : input.actor.userId, reason: input.reason, updatedAt: new Date() }).where(and(eq(raffleDraws.id, draw.id), eq(raffleDraws.status, draw.status))).returning();
    if (!updated) throw new Error("Draw changed concurrently");
    if (releasesPrizeUnit(draw.status)) {
      const [prize] = await tx.select().from(rafflePrizes).where(eq(rafflePrizes.id, draw.prizeId)).limit(1);
      if (prize) await tx.update(rafflePrizes).set({ drawnQuantity: sql`greatest(0, ${rafflePrizes.drawnQuantity} - 1)`, status: getPrizeStatusAfterReleasedUnit(prize.status, prize.drawnQuantity - 1), updatedAt: new Date() }).where(and(eq(rafflePrizes.id, draw.prizeId), sql`${rafflePrizes.drawnQuantity} > 0`));
    }
    await insertAudit(tx, { organizationId: input.organizationId, raffleId: draw.raffleId, eventId: input.eventId, prizeId: draw.prizeId, drawId: draw.id, actor: input.actor, action: "invalidate", metadata: { reason: input.reason, previousStatus: draw.status } });
    const [raffle] = await tx.select().from(raffles).where(eq(raffles.id, draw.raffleId)).limit(1);
    if (raffle) await refreshRaffleStatus(tx, { raffle, organizationId: input.organizationId, actor: input.actor });
    return updated;
  });
}

async function claimDrawWithClient(client: RaffleClient, input: { drawId: string; eventId: string; organizationId: string; actor: RaffleActor; note?: string; now?: Date }): Promise<RaffleDrawRow> {
  const result = await (async () => {
    const initial = await getScopedDraw(client, input.drawId, input.eventId, input.organizationId);
    if (!initial) throw new Error("Draw not found");
    await lockRaffleAndPrize(client, initial.raffleId, initial.prizeId);
    const draw = await getScopedDraw(client, input.drawId, input.eventId, input.organizationId);
    if (!draw) throw new Error("Draw not found");
    if (draw.status !== "revealed") throw new Error("Draw cannot be claimed");
    const [prize] = await client.select().from(rafflePrizes).where(eq(rafflePrizes.id, draw.prizeId)).limit(1);
    if (!prize) throw new Error("Prize not found");
    const now = input.now ?? new Date();
    if (isClaimDeadlinePassed(prize.claimDeadlineAt, now)) {
      const [unclaimed] = await client.update(raffleDraws).set({ status: "unclaimed", updatedAt: now }).where(and(eq(raffleDraws.id, draw.id), eq(raffleDraws.status, "revealed"))).returning();
      if (!unclaimed) throw new Error("Draw changed concurrently");
      await client.update(rafflePrizes).set({ drawnQuantity: sql`greatest(0, ${rafflePrizes.drawnQuantity} - 1)`, status: getPrizeStatusAfterReleasedUnit(prize.status, prize.drawnQuantity - 1), updatedAt: now }).where(and(eq(rafflePrizes.id, prize.id), sql`${rafflePrizes.drawnQuantity} > 0`));
      await insertAudit(client, { organizationId: input.organizationId, raffleId: draw.raffleId, eventId: input.eventId, prizeId: draw.prizeId, drawId: draw.id, actor: input.actor, action: "status_change", metadata: { status: "unclaimed", reason: "claim_deadline_passed" } });
      const [raffle] = await client.select().from(raffles).where(eq(raffles.id, draw.raffleId)).limit(1);
      if (raffle) await refreshRaffleStatus(client, { raffle, organizationId: input.organizationId, actor: input.actor });
      return { draw: unclaimed, expired: true } as const;
    }
    const [claimed] = await client.update(raffleDraws).set({
      status: "claimed",
      claimedAt: now,
      claimedBy: input.actor.type === "hcs" ? null : input.actor.userId,
      claimedByExternal: input.actor.type === "hcs" ? input.actor.actorId : null,
      updatedAt: now,
    }).where(and(eq(raffleDraws.id, draw.id), eq(raffleDraws.status, "revealed"))).returning();
    if (!claimed) throw new Error("Draw changed concurrently");
    await insertAudit(client, { organizationId: input.organizationId, raffleId: draw.raffleId, eventId: input.eventId, prizeId: draw.prizeId, drawId: draw.id, actor: input.actor, action: "claim", metadata: input.note ? { note: input.note } : {} });
    return { draw: claimed, expired: false } as const;
  })();
  if (result.expired) throw new Error("Claim deadline has passed");
  return result.draw;
}

export async function claimDraw(input: { drawId: string; eventId: string; organizationId: string; actor: RaffleActor; note?: string; now?: Date }): Promise<RaffleDrawRow> {
  return db.transaction((tx) => claimDrawWithClient(tx, input));
}

export async function confirmDrawAndNotify(input: { drawId: string; eventId: string; organizationId: string; actor: RaffleActor }): Promise<RaffleDrawRow> {
  const initial = await getScopedDraw(db, input.drawId, input.eventId, input.organizationId);
  if (!initial) throw new Error("Draw not found");
  if (initial.status === "invalidated" || initial.status === "unclaimed") throw new Error("Draw cannot be confirmed");
  const revealed = initial.status === "pending_reveal" ? await revealDraw(input) : initial;
  const draw = revealed.status === "revealed" ? await claimDraw(input) : revealed;
  const rows = await db.select({ draw: raffleDraws, prize: rafflePrizes, event: events }).from(raffleDraws).innerJoin(rafflePrizes, eq(rafflePrizes.id, raffleDraws.prizeId)).innerJoin(events, eq(events.id, raffleDraws.eventId)).where(and(eq(raffleDraws.id, draw.id), eq(raffleDraws.organizationId, input.organizationId))).limit(1);
  const scoped = rows[0];
  if (!scoped) throw new Error("Draw not found");
  await sendRaffleWinnerEmail({ organizationId: input.organizationId, drawId: draw.id, to: draw.attendeeEmail, winnerName: draw.attendeeName, eventName: scoped.event.name, prizeName: scoped.prize.name, redemptionCode: draw.attendeeCode, reason: null, instructions: scoped.prize.instructions, claimDeadlineAt: scoped.prize.claimDeadlineAt });
  return draw;
}

export type HcsRaffleClaimActor = Extract<RaffleActor, { type: "hcs" }>;

export async function validateRaffleCode(input: { eventId: string; organizationId: string; connectionId: string; requestId: string; code: string; actor: HcsRaffleClaimActor }) {
  const attendees = await db.select({ attendee: eventAttendees, event: events }).from(eventAttendees).innerJoin(events, eq(events.id, eventAttendees.eventId)).where(and(eq(eventAttendees.eventId, input.eventId), eq(eventAttendees.organizationId, input.organizationId), eq(eventAttendees.backupCode, input.code.trim()))).limit(1);
  const attendee = attendees[0]?.attendee;
  if (!attendee) throw Object.assign(new Error("Attendee not found"), { status: 404 });

  const draws = await db.select({ draw: raffleDraws, prize: rafflePrizes }).from(raffleDraws).innerJoin(rafflePrizes, eq(rafflePrizes.id, raffleDraws.prizeId)).where(and(eq(raffleDraws.eventId, input.eventId), eq(raffleDraws.organizationId, input.organizationId), eq(raffleDraws.attendeeId, attendee.id), ne(raffleDraws.status, "invalidated"))).orderBy(asc(raffleDraws.drawnAt)).limit(1);
  const selected = draws[0];
  const raffle = await db.select().from(raffles).where(and(eq(raffles.eventId, input.eventId), eq(raffles.organizationId, input.organizationId))).limit(1);
  if (raffle[0]) {
    await insertAudit(db, { organizationId: input.organizationId, raffleId: raffle[0].id, eventId: input.eventId, actor: input.actor, action: "validate", metadata: { connectionId: input.connectionId, requestId: input.requestId } });
  }
  if (!selected) return { valid: true, hasPrize: false, message: "Participante válido, todavía no tiene premio asignado" } as const;
  const claimStatus = selected.draw.status === "pending_reveal" || selected.draw.status === "revealed" ? "pending" : selected.draw.status;
  return {
    valid: true,
    hasPrize: true,
    event: { id: attendees[0].event.id, name: attendees[0].event.name },
    winner: {
      id: selected.draw.id,
      name: selected.draw.attendeeName,
      prizeName: selected.prize.name,
      drawId: selected.draw.id,
      drawnAt: selected.draw.drawnAt,
      claimStatus,
      emailStatus: "unknown" as const,
    },
  };
}

export async function claimHcsDraw(input: { drawId: string; code: string; eventId: string; organizationId: string; actor: HcsRaffleClaimActor; note?: string; now?: Date; client?: RaffleClient }) {
  const client = input.client ?? db;
  const rows = await client.select({ id: raffleDraws.id, attendeeCode: raffleDraws.attendeeCode }).from(raffleDraws).where(and(eq(raffleDraws.id, input.drawId), eq(raffleDraws.eventId, input.eventId), eq(raffleDraws.organizationId, input.organizationId))).limit(1);
  const draw = rows[0];
  if (!draw) throw Object.assign(new Error("Draw not found"), { status: 404 });
  if (draw.attendeeCode !== input.code.trim()) throw Object.assign(new Error("Code does not match draw"), { status: 404 });
  const claimed = input.client
    ? await claimDrawWithClient(input.client, input)
    : await claimDraw({ drawId: input.drawId, eventId: input.eventId, organizationId: input.organizationId, actor: input.actor, note: input.note, now: input.now });
  return { drawId: claimed.id, status: "claimed" as const, claimedAt: claimed.claimedAt, claimedBy: claimed.claimedByExternal };
}

export async function resendHcsWinnerEmail(input: {
  drawId: string;
  eventId: string;
  organizationId: string;
  connectionId: string;
  actor: HcsRaffleClaimActor;
  reason: string | null;
  client?: RaffleClient;
}) {
  const client = input.client ?? db;
  const rows = await client
    .select({ draw: raffleDraws, prize: rafflePrizes, event: events })
    .from(raffleDraws)
    .innerJoin(rafflePrizes, eq(rafflePrizes.id, raffleDraws.prizeId))
    .innerJoin(events, eq(events.id, raffleDraws.eventId))
    .where(and(eq(raffleDraws.id, input.drawId), eq(raffleDraws.eventId, input.eventId), eq(raffleDraws.organizationId, input.organizationId), eq(rafflePrizes.organizationId, input.organizationId), eq(events.organizationId, input.organizationId)))
    .limit(1);
  const scoped = rows[0];
  if (!scoped) throw Object.assign(new Error("Draw not found"), { status: 404 });
  if (scoped.draw.status === "invalidated") throw Object.assign(new Error("Draw invalidated"), { status: 409 });

  try {
    const email = await sendRaffleWinnerEmail({
      organizationId: input.organizationId,
      drawId: scoped.draw.id,
      to: scoped.draw.attendeeEmail,
      winnerName: scoped.draw.attendeeName,
      eventName: scoped.event.name,
      prizeName: scoped.prize.name,
      redemptionCode: scoped.draw.attendeeCode,
      reason: input.reason,
      instructions: scoped.prize.instructions,
      claimDeadlineAt: scoped.prize.claimDeadlineAt,
      client,
    });
    await insertAudit(client, {
      organizationId: input.organizationId,
      raffleId: scoped.draw.raffleId,
      eventId: input.eventId,
      prizeId: scoped.draw.prizeId,
      drawId: scoped.draw.id,
      actor: input.actor,
      action: "resend_request",
      metadata: { connectionId: input.connectionId, reason: input.reason, providerResult: { status: email.status } },
    });
    return email;
  } catch (error) {
    await insertAudit(client, {
      organizationId: input.organizationId,
      raffleId: scoped.draw.raffleId,
      eventId: input.eventId,
      prizeId: scoped.draw.prizeId,
      drawId: scoped.draw.id,
      actor: input.actor,
      action: "resend_request",
      metadata: { connectionId: input.connectionId, reason: input.reason, providerResult: { status: "failed" } },
    });
    throw error;
  }
}

export async function listRaffleAudit(input: { raffleId: string; eventId: string; organizationId: string }): Promise<RaffleAuditRow[]> {
  return db.select().from(raffleAudit).where(and(eq(raffleAudit.raffleId, input.raffleId), eq(raffleAudit.eventId, input.eventId), eq(raffleAudit.organizationId, input.organizationId))).orderBy(asc(raffleAudit.createdAt));
}

export async function listRafflePrizes(input: { raffleId: string; organizationId: string }): Promise<RafflePrizeRow[]> {
  return db.select().from(rafflePrizes).where(and(eq(rafflePrizes.raffleId, input.raffleId), eq(rafflePrizes.organizationId, input.organizationId))).orderBy(asc(rafflePrizes.createdAt));
}

export async function listRaffleDraws(input: { raffleId: string; eventId: string; organizationId: string }): Promise<RaffleDrawRow[]> {
  return db.select().from(raffleDraws).where(and(eq(raffleDraws.raffleId, input.raffleId), eq(raffleDraws.eventId, input.eventId), eq(raffleDraws.organizationId, input.organizationId))).orderBy(asc(raffleDraws.drawnAt));
}

export async function expireUnclaimedDraws(input: { eventId: string; organizationId: string; actor: RaffleActor; now?: Date }): Promise<number> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const rows = await tx.select({ draw: raffleDraws, prize: rafflePrizes }).from(raffleDraws).innerJoin(rafflePrizes, eq(rafflePrizes.id, raffleDraws.prizeId)).where(and(eq(raffleDraws.eventId, input.eventId), eq(raffleDraws.organizationId, input.organizationId), eq(raffleDraws.status, "revealed"), isNotNull(rafflePrizes.claimDeadlineAt)));
    let expired = 0;
    for (const row of rows) {
      if (!isClaimDeadlinePassed(row.prize.claimDeadlineAt, now)) continue;
      await lockRaffleAndPrize(tx, row.draw.raffleId, row.draw.prizeId);
      await tx.execute(sql`SELECT ${raffleDraws.id} FROM ${raffleDraws} WHERE ${raffleDraws.id} = ${row.draw.id} FOR UPDATE`);
      const [prize] = await tx.select().from(rafflePrizes).where(eq(rafflePrizes.id, row.draw.prizeId)).limit(1);
      if (!prize || !isClaimDeadlinePassed(prize.claimDeadlineAt, now)) continue;
      const [updated] = await tx.update(raffleDraws).set({ status: "unclaimed", updatedAt: now }).where(and(eq(raffleDraws.id, row.draw.id), eq(raffleDraws.status, "revealed"))).returning();
      if (!updated) continue;
      await tx.update(rafflePrizes).set({ drawnQuantity: sql`greatest(0, ${rafflePrizes.drawnQuantity} - 1)`, status: getPrizeStatusAfterReleasedUnit(prize.status, prize.drawnQuantity - 1), updatedAt: now }).where(and(eq(rafflePrizes.id, row.draw.prizeId), sql`${rafflePrizes.drawnQuantity} > 0`));
      await insertAudit(tx, { organizationId: input.organizationId, raffleId: row.draw.raffleId, eventId: input.eventId, prizeId: row.draw.prizeId, drawId: row.draw.id, actor: input.actor, action: "status_change", metadata: { status: "unclaimed", reason: "claim_deadline_passed" } });
      const [raffle] = await tx.select().from(raffles).where(eq(raffles.id, row.draw.raffleId)).limit(1);
      if (raffle) await refreshRaffleStatus(tx, { raffle, organizationId: input.organizationId, actor: input.actor });
      expired += 1;
    }
    return expired;
  });
}
