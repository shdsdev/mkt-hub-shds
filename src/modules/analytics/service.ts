import { count, countDistinct, eq, and, gte, lte, sql, asc, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { trackingEvents, trackingRollupDaily } from "./db";
import { createTrackingBuffer } from "./buffer";
import { isKnownBot } from "./bot";
import { formatRollupCsv, type RollupRow } from "./csv";
import { getQrCode } from "@/modules/qr";

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
  deviceType?: string;
  geoCountry?: string;
  geoCity?: string;
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
    deviceType: input.deviceType,
    geoCountry: input.geoCountry,
    geoCity: input.geoCity,
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

// A scan isn't tagged with the qrCodeId that triggered it — the redirect hot path can't know
// which specific QR image was scanned, only which route was hit (SPEC.md §25). Every hit to
// /q/<slug> for a short link IS QR scan traffic for the link it resolves to, by construction — so
// we resolve the QR's link and count by linkId + source_type instead.
export async function countEventsForQrCode(qrCodeId: string): Promise<number> {
  const qr = await getQrCode(qrCodeId);
  if (!qr?.linkId) return 0;

  const [row] = await db
    .select({ count: count() })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.linkId, qr.linkId), eq(trackingEvents.sourceType, "qr_scan")));
  return row?.count ?? 0;
}

export async function countUniqueScansForQrCode(qrCodeId: string): Promise<number> {
  const qr = await getQrCode(qrCodeId);
  if (!qr?.linkId) return 0;

  const [row] = await db
    .select({ count: countDistinct(trackingEvents.visitorHash) })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.linkId, qr.linkId), eq(trackingEvents.sourceType, "qr_scan")));
  return row?.count ?? 0;
}

// Direct linkId versions — the analytics page (reachable from a link with no QR at all, via the
// Links page's "View analytics") needs these without resolving through a QR row first.
export async function countQrScansForLink(linkId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.linkId, linkId), eq(trackingEvents.sourceType, "qr_scan")));
  return row?.count ?? 0;
}

export async function countUniqueQrScansForLink(linkId: string): Promise<number> {
  const [row] = await db
    .select({ count: countDistinct(trackingEvents.visitorHash) })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.linkId, linkId), eq(trackingEvents.sourceType, "qr_scan")));
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

export type ScanGranularity = "day" | "week" | "month";
export type ScanBucket = { bucket: string; scansHuman: number };

// "day" reads tracking_rollup_daily rows directly; "week"/"month" sum them into coarser buckets
// via date_trunc — both stay within the already-rolled-up table, no raw tracking_events touched.
export async function getScansForLinkGrouped(
  linkId: string,
  granularity: ScanGranularity,
  from: Date,
  to: Date,
): Promise<ScanBucket[]> {
  if (granularity === "day") {
    const rows = await db
      .select({ bucket: trackingRollupDaily.date, scansHuman: trackingRollupDaily.scansHuman })
      .from(trackingRollupDaily)
      .where(
        and(
          eq(trackingRollupDaily.linkId, linkId),
          gte(trackingRollupDaily.date, from.toISOString().slice(0, 10)),
          lte(trackingRollupDaily.date, to.toISOString().slice(0, 10)),
        ),
      )
      .orderBy(asc(trackingRollupDaily.date));
    return rows;
  }

  const truncUnit = granularity === "week" ? "week" : "month";
  const rows = await db.execute<{ bucket: string; scans_human: number }>(sql`
    SELECT date_trunc(${truncUnit}, ${trackingRollupDaily.date}::date)::date::text AS bucket,
           sum(${trackingRollupDaily.scansHuman})::int AS scans_human
    FROM ${trackingRollupDaily}
    WHERE ${trackingRollupDaily.linkId} = ${linkId}
      AND ${trackingRollupDaily.date} >= ${from.toISOString().slice(0, 10)}
      AND ${trackingRollupDaily.date} <= ${to.toISOString().slice(0, 10)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  return rows.map((row) => ({ bucket: row.bucket, scansHuman: row.scans_human }));
}

export type BreakdownRow = { label: string; count: number };

// Keyed by linkId, not shortLinkId/qrCodeId — a link's QR scan traffic is whatever hit /q/<slug>
// for any short link pointing at it, and every tracking_events row already carries linkId
// directly. This also means the analytics page works for a link with no QR at all (it just shows
// zero qr_scan rows), which matters because the Links page's "View analytics" link points here
// too, for links that only ever got a plain short link.
async function breakdownForLink(
  linkId: string,
  column: typeof trackingEvents.deviceType | typeof trackingEvents.geoCountry | typeof trackingEvents.geoCity,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  const rows = await db
    .select({ label: column, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.linkId, linkId),
        eq(trackingEvents.sourceType, "qr_scan"),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(column)
    .orderBy(desc(count()))
    .limit(5);

  return rows
    .filter((row) => row.label !== null)
    .map((row) => ({ label: row.label as string, count: row.count }));
}

export async function getDeviceBreakdownForLink(
  linkId: string,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  return breakdownForLink(linkId, trackingEvents.deviceType, from, to);
}

export async function getCountryBreakdownForLink(
  linkId: string,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  return breakdownForLink(linkId, trackingEvents.geoCountry, from, to);
}

export async function getCityBreakdownForLink(
  linkId: string,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  return breakdownForLink(linkId, trackingEvents.geoCity, from, to);
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
