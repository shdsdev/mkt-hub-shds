import { count, eq, and, gte, sql, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { trackingEvents, trackingRollupDaily } from "./db";
import { createTrackingBuffer } from "./buffer";
import { isKnownBot } from "./bot";
import { formatRollupCsv, type RollupRow } from "./csv";

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

// One atomic upsert-from-aggregate — idempotent (safe to re-run), covers any past day not yet
// rolled up (not just "yesterday"), never touches today (still accumulating). The retention/
// partition-drop half of DATABASE.md's design is deliberately not built yet (Phase 7 design doc).
export async function runDailyRollup(): Promise<void> {
  await db.execute(sql`
    INSERT INTO tracking_rollup_daily (organization_id, link_id, date, clicks_human, clicks_bot, scans_human, scans_bot)
    SELECT
      organization_id,
      link_id,
      created_at::date AS date,
      count(*) FILTER (WHERE source_type = 'link_click' AND is_bot = false),
      count(*) FILTER (WHERE source_type = 'link_click' AND is_bot = true),
      count(*) FILTER (WHERE source_type = 'qr_scan' AND is_bot = false),
      count(*) FILTER (WHERE source_type = 'qr_scan' AND is_bot = true)
    FROM tracking_events
    WHERE created_at::date < current_date
    GROUP BY organization_id, link_id, created_at::date
    ON CONFLICT (link_id, date) DO UPDATE SET
      clicks_human = EXCLUDED.clicks_human,
      clicks_bot = EXCLUDED.clicks_bot,
      scans_human = EXCLUDED.scans_human,
      scans_bot = EXCLUDED.scans_bot
  `);
}

export type RollupTotals = {
  clicksHuman: number;
  clicksBot: number;
  scansHuman: number;
  scansBot: number;
};

export async function getRollupForLink(linkId: string): Promise<RollupRow[]> {
  const rows = await db
    .select()
    .from(trackingRollupDaily)
    .where(eq(trackingRollupDaily.linkId, linkId))
    .orderBy(asc(trackingRollupDaily.date));

  return rows.map((row) => ({
    date: row.date,
    clicksHuman: row.clicksHuman,
    clicksBot: row.clicksBot,
    scansHuman: row.scansHuman,
    scansBot: row.scansBot,
  }));
}

export async function getRollupTotalsForLink(linkId: string): Promise<RollupTotals> {
  const rows = await getRollupForLink(linkId);
  return rows.reduce(
    (totals, row) => ({
      clicksHuman: totals.clicksHuman + row.clicksHuman,
      clicksBot: totals.clicksBot + row.clicksBot,
      scansHuman: totals.scansHuman + row.scansHuman,
      scansBot: totals.scansBot + row.scansBot,
    }),
    { clicksHuman: 0, clicksBot: 0, scansHuman: 0, scansBot: 0 },
  );
}

export async function exportRollupCsvForLink(linkId: string): Promise<string> {
  const rows = await getRollupForLink(linkId);
  return formatRollupCsv(rows);
}

// Org-wide, human-only, last 30 days — the one Overview stat that isn't a simple status count on
// another module's table (Phase 8 design).
export async function getOrgTrafficLast30Days(organizationId: string): Promise<number> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [row] = await db
    .select({ count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.isBot, false),
        gte(trackingEvents.createdAt, since),
      ),
    );
  return row?.count ?? 0;
}
