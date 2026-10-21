"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { canAccessEvent } from "@/modules/events";
import { isActive } from "@/modules/users";
import {
  confirmDrawAndNotify,
  createPrize,
  drawPrizeUnit,
  increasePrizeQuantity,
  invalidateDraw,
  revealDraw,
  rotateRaffleStageToken,
  updatePrize,
} from "@/modules/raffles";

export type RaffleActionState = { error?: string; success?: string; stageUrl?: string };

const uuid = z.string().uuid();
const eventFields = z.object({ eventId: uuid });
const prizeBase = eventFields.extend({ raffleId: uuid });
const optionalText = z.string().trim().max(5000).optional().or(z.literal(""));
const winnerPolicy = z.enum(["include_winners", "exclude_winners"]);

function value(formData: FormData, key: string) {
  return formData.get(key) ?? undefined;
}

function csv(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "");
  if (!raw || raw.trim() === "all") return undefined;
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return values.length ? values : undefined;
}

function filterValue(formData: FormData, key: string) {
  const raw = String(value(formData, key) ?? "").trim();
  return raw && raw !== "all" ? raw : undefined;
}

async function requireRaffleAdmin(eventId: string) {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile)) return undefined;
  if (!(await canAccessEvent({ userId: user.id, organizationId: user.profile.organizationId, role: user.profile.role, eventId, capability: "raffle" }))) return undefined;
  return user;
}

function route(eventId: string) {
  return `/events/${eventId}/raffle`;
}

function failure(error: unknown): RaffleActionState {
  if (error instanceof Error && error.message === "No eligible attendees") return { error: "No hay asistentes elegibles con los filtros seleccionados." };
  return { error: error instanceof Error ? error.message : "No se pudo actualizar el sorteo." };
}

export async function createPrizeAction(_state: RaffleActionState, formData: FormData): Promise<RaffleActionState> {
  const parsed = prizeBase.extend({
    name: z.string().trim().min(1).max(255),
    quantity: z.coerce.number().int().min(1),
    instructions: optionalText,
    claimDeadlineAt: z.string().optional().transform((input) => input ? new Date(input) : null),
    fulfillmentContact: optionalText,
    conditions: optionalText,
    winnerPolicy: winnerPolicy.default("exclude_winners"),
  }).safeParse({
    eventId: value(formData, "eventId"), raffleId: value(formData, "raffleId"), name: value(formData, "name"),
    quantity: value(formData, "quantity"), instructions: value(formData, "instructions"),
    claimDeadlineAt: value(formData, "claimDeadlineAt"), fulfillmentContact: value(formData, "fulfillmentContact"),
    conditions: value(formData, "conditions"), winnerPolicy: value(formData, "winnerPolicy") || undefined,
  });
  if (!parsed.success || (parsed.data.claimDeadlineAt && Number.isNaN(parsed.data.claimDeadlineAt.getTime()))) return { error: "Revisa la configuración del premio." };
  const user = await requireRaffleAdmin(parsed.data.eventId);
  if (!user) return { error: "No tienes permiso para administrar este sorteo." };
  try {
    await createPrize({ ...parsed.data, actorUserId: user.id, actorEmail: user.email, organizationId: user.profile.organizationId, instructions: parsed.data.instructions || null, fulfillmentContact: parsed.data.fulfillmentContact || null, conditions: parsed.data.conditions || null });
    revalidatePath(route(parsed.data.eventId));
    return { success: "Premio agregado." };
  } catch (error) { return failure(error); }
}

export async function togglePrizeAction(formData: FormData): Promise<RaffleActionState> {
  const parsed = prizeBase.extend({ prizeId: uuid, status: z.enum(["ready", "active", "paused", "finished"]) }).safeParse({ eventId: value(formData, "eventId"), raffleId: value(formData, "raffleId"), prizeId: value(formData, "prizeId"), status: value(formData, "status") });
  if (!parsed.success) return { error: "Premio inválido." };
  const user = await requireRaffleAdmin(parsed.data.eventId);
  if (!user) return { error: "No tienes permiso para administrar este sorteo." };
  try {
    await updatePrize({ ...parsed.data, organizationId: user.profile.organizationId, actorUserId: user.id, actorEmail: user.email, changes: { status: parsed.data.status } });
    revalidatePath(route(parsed.data.eventId));
    return { success: parsed.data.status === "paused" ? "Premio pausado." : "Premio reanudado." };
  } catch (error) { return failure(error); }
}

export async function increasePrizeQuantityAction(formData: FormData): Promise<RaffleActionState> {
  const parsed = prizeBase.extend({ prizeId: uuid, amount: z.coerce.number().int().min(1) }).safeParse({ eventId: value(formData, "eventId"), raffleId: value(formData, "raffleId"), prizeId: value(formData, "prizeId"), amount: value(formData, "amount") });
  if (!parsed.success) return { error: "Indica una cantidad válida." };
  const user = await requireRaffleAdmin(parsed.data.eventId);
  if (!user) return { error: "No tienes permiso para administrar este sorteo." };
  try {
    await increasePrizeQuantity({ ...parsed.data, organizationId: user.profile.organizationId, actorUserId: user.id, actorEmail: user.email });
    revalidatePath(route(parsed.data.eventId));
    return { success: "Cantidad actualizada." };
  } catch (error) { return failure(error); }
}

export async function drawPrizeAction(formData: FormData): Promise<RaffleActionState> {
  const parsed = eventFields.extend({ prizeId: uuid, idempotencyKey: z.string().uuid().optional() }).safeParse({ eventId: value(formData, "eventId"), prizeId: value(formData, "prizeId"), idempotencyKey: value(formData, "idempotencyKey") || undefined });
  if (!parsed.success) return { error: "No se pudo iniciar el sorteo." };
  const user = await requireRaffleAdmin(parsed.data.eventId);
  if (!user) return { error: "No tienes permiso para administrar este sorteo." };
  try {
    await drawPrizeUnit({ eventId: parsed.data.eventId, prizeId: parsed.data.prizeId, organizationId: user.profile.organizationId, actor: { userId: user.id, email: user.email }, idempotencyKey: parsed.data.idempotencyKey ?? crypto.randomUUID(), filters: { occupation: filterValue(formData, "occupation"), clientBrands: csv(formData, "clientBrands"), interests: csv(formData, "interests") } });
    revalidatePath(route(parsed.data.eventId));
    return { success: "Ganador sorteado. Revela el resultado para continuar." };
  } catch (error) { return failure(error); }
}

export async function rotateRaffleStageTokenAction(_state: RaffleActionState, formData: FormData): Promise<RaffleActionState> {
  const parsed = eventFields.safeParse({ eventId: value(formData, "eventId") });
  if (!parsed.success) return { error: "Evento inválido." };
  const user = await requireRaffleAdmin(parsed.data.eventId);
  if (!user) return { error: "No tienes permiso para administrar este sorteo." };
  try {
    const { token } = await rotateRaffleStageToken(parsed.data.eventId, user.profile.organizationId);
    return { success: "Enlace de escenario generado.", stageUrl: new URL(`/events/${parsed.data.eventId}/raffle/${token}`, process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000").toString() };
  } catch (error) { return failure(error); }
}

async function drawMutation(formData: FormData, operation: "reveal" | "claim"): Promise<RaffleActionState> {
  const parsed = eventFields.extend({ drawId: uuid }).safeParse({ eventId: value(formData, "eventId"), drawId: value(formData, "drawId") });
  if (!parsed.success) return { error: "Sorteo inválido." };
  const user = await requireRaffleAdmin(parsed.data.eventId);
  if (!user) return { error: "No tienes permiso para administrar este sorteo." };
  const input = { drawId: parsed.data.drawId, eventId: parsed.data.eventId, organizationId: user.profile.organizationId, actor: { userId: user.id, email: user.email } };
  try {
    if (operation === "reveal") await revealDraw(input);
    else await confirmDrawAndNotify(input);
    revalidatePath(route(parsed.data.eventId));
    return { success: operation === "reveal" ? "Resultado revelado." : "Premio marcado como entregado." };
  } catch (error) { return failure(error); }
}

export async function revealDrawAction(formData: FormData) { return drawMutation(formData, "reveal"); }
export async function claimDrawAction(formData: FormData) { return drawMutation(formData, "claim"); }

export async function invalidateDrawAction(formData: FormData): Promise<RaffleActionState> {
  const parsed = eventFields.extend({ drawId: uuid, reason: z.string().trim().min(1).max(1000) }).safeParse({ eventId: value(formData, "eventId"), drawId: value(formData, "drawId"), reason: value(formData, "reason") });
  if (!parsed.success) return { error: "Indica el motivo de la invalidación." };
  const user = await requireRaffleAdmin(parsed.data.eventId);
  if (!user) return { error: "No tienes permiso para administrar este sorteo." };
  try {
    await invalidateDraw({ drawId: parsed.data.drawId, eventId: parsed.data.eventId, organizationId: user.profile.organizationId, actor: { userId: user.id, email: user.email }, reason: parsed.data.reason });
    revalidatePath(route(parsed.data.eventId));
    return { success: "Resultado invalidado y cantidad liberada." };
  } catch (error) { return failure(error); }
}
