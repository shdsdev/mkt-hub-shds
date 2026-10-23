import { and, eq, lte, or, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/lib/env";
import { ga4EventOutbox } from "./db";
import { Ga4DeliveryError, sendMeasurementProtocolEvent, type Ga4OutboxEvent } from "./google";

const LOCK_SECONDS = 120;
const MAX_UNCERTAIN_ATTEMPTS = 5;

export type OutboxDeliveryState = "received" | "failed" | "uncertain";

export function nextOutboxDeliveryState(
  error: Ga4DeliveryError,
  attempts: number,
): { status: OutboxDeliveryState; availableAt?: Date } {
  if (error.kind === "failed") return { status: "failed" };
  if (attempts >= MAX_UNCERTAIN_ATTEMPTS) return { status: "failed" };
  const delaySeconds = Math.min(60 * 2 ** Math.max(attempts - 1, 0), 3600);
  return { status: "uncertain", availableAt: new Date(Date.now() + delaySeconds * 1000) };
}

async function claimOutboxBatch(limit: number) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_SECONDS * 1000);
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(ga4EventOutbox)
      .where(
        or(
          and(eq(ga4EventOutbox.status, "pending"), lte(ga4EventOutbox.availableAt, now)),
          and(eq(ga4EventOutbox.status, "processing"), lte(ga4EventOutbox.lockedUntil, now)),
        ),
      )
      .limit(limit)
      .for("update", { skipLocked: true });

    if (rows.length === 0) return [];
    await tx
      .update(ga4EventOutbox)
      .set({ status: "processing", lockedUntil, updatedAt: now })
      .where(inArray(ga4EventOutbox.id, rows.map((row) => row.id)));
    return rows;
  });
}

export type ProcessGa4OutboxResult = {
  disabled: boolean;
  claimed: number;
  received: number;
  failed: number;
  uncertain: number;
};

export async function processGa4Outbox(limit = 25): Promise<ProcessGa4OutboxResult> {
  const result: ProcessGa4OutboxResult = { disabled: false, claimed: 0, received: 0, failed: 0, uncertain: 0 };
  if (!env.NEXT_PUBLIC_GA_MEASUREMENT_ID || !env.GA4_API_SECRET) return { ...result, disabled: true };

  const rows = await claimOutboxBatch(limit);
  result.claimed = rows.length;

  for (const row of rows) {
    const event: Ga4OutboxEvent = {
      id: row.trackingEventId,
      clientId: row.clientId,
      linkId: row.linkId,
      shortLinkId: row.shortLinkId,
      sourceType: row.sourceType,
    };
    try {
      await sendMeasurementProtocolEvent(event, {
        measurementId: env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
        apiSecret: env.GA4_API_SECRET,
      });
      await db
        .update(ga4EventOutbox)
        .set({ status: "received", attempts: row.attempts + 1, lockedUntil: null, updatedAt: new Date() })
        .where(eq(ga4EventOutbox.id, row.id));
      result.received += 1;
    } catch (error) {
      const deliveryError = error instanceof Ga4DeliveryError
        ? error
        : new Ga4DeliveryError("uncertain", "Unexpected GA4 delivery error.");
      const next = nextOutboxDeliveryState(deliveryError, row.attempts + 1);
      await db
        .update(ga4EventOutbox)
        .set({
          status: next.status,
          attempts: row.attempts + 1,
          availableAt: next.availableAt ?? row.availableAt,
          lockedUntil: null,
          lastError: deliveryError.message,
          updatedAt: new Date(),
        })
        .where(eq(ga4EventOutbox.id, row.id));
      result[next.status] += 1;
    }
  }

  return result;
}
