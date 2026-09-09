import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trackingEvents } from "./db";
import { createTrackingBuffer } from "./buffer";
import { isKnownBot } from "./bot";

export type TrackEventInput = typeof trackingEvents.$inferInsert;

const buffer = createTrackingBuffer<TrackEventInput>({
  flush: async (events) => {
    await db.insert(trackingEvents).values(events);
  },
  maxSize: 500,
  flushIntervalMs: 1000,
});

// Force a final flush on shutdown so a container restart doesn't silently drop the last <1s of
// buffered events. Guarded so re-registering across hot-reloads in dev doesn't stack listeners.
const globalForShutdownHook = globalThis as unknown as { __trackingShutdownHookRegistered?: boolean };
if (!globalForShutdownHook.__trackingShutdownHookRegistered) {
  globalForShutdownHook.__trackingShutdownHookRegistered = true;
  const flushAndExit = () => {
    void buffer.flush().finally(() => process.exit(0));
  };
  process.on("SIGTERM", flushAndExit);
  process.on("SIGINT", flushAndExit);
}

// Fire-and-forget from the caller's perspective — the 302 has already been sent by the time this
// resolves (I-5). Never throws.
export function trackRedirect(input: {
  organizationId: string;
  linkId: string;
  shortLinkId: string;
  qrCodeId?: string;
  campaignId?: string | null;
  sourceType: "link_click" | "qr_scan";
  visitorHash: string;
  userAgent: string | null;
}): void {
  const now = new Date();
  buffer.enqueue({
    organizationId: input.organizationId,
    linkId: input.linkId,
    shortLinkId: input.shortLinkId,
    qrCodeId: input.qrCodeId,
    campaignId: input.campaignId ?? undefined,
    sourceType: input.sourceType,
    isBot: isKnownBot(input.userAgent),
    visitorHash: input.visitorHash,
    sessionStartedAt: now,
  });
}

// Includes buffered-but-not-yet-flushed events? No — only what's persisted. Acceptable: scan_rate
// is a reporting figure, not the redirect hot path, and the buffer flushes within ~1s (I-5).
export async function countEventsForShortLink(shortLinkId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trackingEvents)
    .where(eq(trackingEvents.shortLinkId, shortLinkId));
  return row?.count ?? 0;
}

export async function countEventsForQrCode(qrCodeId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trackingEvents)
    .where(eq(trackingEvents.qrCodeId, qrCodeId));
  return row?.count ?? 0;
}
