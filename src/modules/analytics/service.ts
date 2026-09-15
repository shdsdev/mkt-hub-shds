import { count, countDistinct, eq, and, gte, lte, sql, asc, desc, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { trackingEvents, trackingRollupDaily } from "./db";
import { createTrackingBuffer } from "./buffer";
import { isKnownBot } from "./bot";
import { formatAnalyticsCsv } from "./csv";
import { utcDayBounds, previousPeriod, daysBetween, type AnalyticsDateRange } from "./date-range";
import { percentChange } from "./percent-change";
import { getAnalyticsSource, type AnalyticsEventType } from "./source";
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
  geoRegion?: string;
  referrer?: string;
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
    region: input.geoRegion,
    referrer: input.referrer,
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

export async function countUniqueEventsForLink(
  linkId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<number> {
  const [row] = await db
    .select({ count: countDistinct(trackingEvents.visitorHash) })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.linkId, linkId),
        eq(trackingEvents.sourceType, eventType),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    );
  return row?.count ?? 0;
}

export async function getAnalyticsTotalsForLink(
  linkId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<{ total: number; unique: number }> {
  const humanColumn = humanRollupColumn(eventType);
  const [totalRow] = await db
    .select({ total: sum(humanColumn) })
    .from(trackingRollupDaily)
    .where(
      and(
        eq(trackingRollupDaily.linkId, linkId),
        gte(trackingRollupDaily.date, from.toISOString().slice(0, 10)),
        lte(trackingRollupDaily.date, to.toISOString().slice(0, 10)),
      ),
    );
  const unique = await countUniqueEventsForLink(linkId, eventType, from, to);
  return { total: Number(totalRow?.total ?? 0), unique };
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

export type AnalyticsGranularity = "day" | "week" | "month";
export type AnalyticsBucket = { bucket: string; count: number };

function humanRollupColumn(eventType: AnalyticsEventType) {
  return eventType === "qr_scan" ? trackingRollupDaily.scansHuman : trackingRollupDaily.clicksHuman;
}

// "day" reads tracking_rollup_daily rows directly; "week"/"month" sum them into coarser buckets
// via date_trunc — both stay within the already-rolled-up table, no raw tracking_events touched.
export async function getAnalyticsForLinkGrouped(
  linkId: string,
  eventType: AnalyticsEventType,
  granularity: AnalyticsGranularity,
  from: Date,
  to: Date,
): Promise<AnalyticsBucket[]> {
  const humanColumn = humanRollupColumn(eventType);
  if (granularity === "day") {
    const rows = await db
      .select({ bucket: trackingRollupDaily.date, count: humanColumn })
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
  const rows = await db.execute<{ bucket: string; count: number }>(sql`
    SELECT date_trunc(${truncUnit}, ${trackingRollupDaily.date}::date)::date::text AS bucket,
           sum(${humanColumn})::int AS count
    FROM ${trackingRollupDaily}
    WHERE ${trackingRollupDaily.linkId} = ${linkId}
      AND ${trackingRollupDaily.date} >= ${from.toISOString().slice(0, 10)}
      AND ${trackingRollupDaily.date} <= ${to.toISOString().slice(0, 10)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  return rows;
}

export type BreakdownRow = { label: string; count: number };

// Keyed by linkId, not shortLinkId/qrCodeId — a link's QR scan traffic is whatever hit /q/<slug>
// for any short link pointing at it, and every tracking_events row already carries linkId
// directly. This also means the analytics page works for a link with no QR at all (it just shows
// zero qr_scan rows), which matters because the Links page's "View analytics" link points here
// too, for links that only ever got a plain short link.
async function breakdownForLink(
  linkId: string,
  eventType: AnalyticsEventType,
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
        eq(trackingEvents.sourceType, eventType),
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

export async function getAnalyticsBreakdownsForLink(
  linkId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<{ devices: BreakdownRow[]; countries: BreakdownRow[]; cities: BreakdownRow[] }> {
  const [devices, countries, cities] = await Promise.all([
    breakdownForLink(linkId, eventType, trackingEvents.deviceType, from, to),
    breakdownForLink(linkId, eventType, trackingEvents.geoCountry, from, to),
    breakdownForLink(linkId, eventType, trackingEvents.geoCity, from, to),
  ]);
  return { devices, countries, cities };
}

export async function exportAnalyticsCsvForLink(
  linkId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<string> {
  const { from, to } = utcDayBounds(range);
  const rows = await getAnalyticsForLinkGrouped(linkId, eventType, "day", from, to);
  const source = getAnalyticsSource(eventType === "qr_scan" ? "qr" : "links");
  return formatAnalyticsCsv(source.csvColumn, rows);
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

// Org-wide daily series, generalizing getAnalyticsForLinkGrouped from one link to every link in
// the organization — grouped by date (unlike the per-link version, which needs no grouping
// because tracking_rollup_daily already has one row per (linkId, date)).
export async function getOrgTrendGrouped(
  organizationId: string,
  eventType: AnalyticsEventType,
  granularity: AnalyticsGranularity,
  from: Date,
  to: Date,
): Promise<AnalyticsBucket[]> {
  const humanColumn = humanRollupColumn(eventType);
  if (granularity === "day") {
    const rows = await db
      .select({ bucket: trackingRollupDaily.date, count: sum(humanColumn) })
      .from(trackingRollupDaily)
      .where(
        and(
          eq(trackingRollupDaily.organizationId, organizationId),
          gte(trackingRollupDaily.date, from.toISOString().slice(0, 10)),
          lte(trackingRollupDaily.date, to.toISOString().slice(0, 10)),
        ),
      )
      .groupBy(trackingRollupDaily.date)
      .orderBy(asc(trackingRollupDaily.date));
    return rows.map((row) => ({ bucket: row.bucket, count: Number(row.count ?? 0) }));
  }

  const truncUnit = granularity === "week" ? "week" : "month";
  const rows = await db.execute<{ bucket: string; count: number }>(sql`
    SELECT date_trunc(${truncUnit}, ${trackingRollupDaily.date}::date)::date::text AS bucket,
           sum(${humanColumn})::int AS count
    FROM ${trackingRollupDaily}
    WHERE ${trackingRollupDaily.organizationId} = ${organizationId}
      AND ${trackingRollupDaily.date} >= ${from.toISOString().slice(0, 10)}
      AND ${trackingRollupDaily.date} <= ${to.toISOString().slice(0, 10)}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  return rows;
}

async function sumRollupInRange(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<number> {
  const humanColumn = humanRollupColumn(eventType);
  const [row] = await db
    .select({ total: sum(humanColumn) })
    .from(trackingRollupDaily)
    .where(
      and(
        eq(trackingRollupDaily.organizationId, organizationId),
        gte(trackingRollupDaily.date, range.from),
        lte(trackingRollupDaily.date, range.to),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function getOrgTotals(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<{ current: number; previous: number; percentChange: number | null }> {
  const [current, previous] = await Promise.all([
    sumRollupInRange(organizationId, eventType, range),
    sumRollupInRange(organizationId, eventType, previousPeriod(range)),
  ]);
  return { current, previous, percentChange: percentChange(current, previous) };
}

// The single day with the most interactions in range; its percentChange compares that day's
// count against the average daily count of the previous period (not the previous period's own
// best day, and not a same-offset day — both would add fragile edge cases at range boundaries
// for no clearer meaning).
export async function getOrgBestDay(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<{ date: string; count: number; percentChange: number | null; previous: number } | null> {
  const humanColumn = humanRollupColumn(eventType);
  const [best] = await db
    .select({ date: trackingRollupDaily.date, count: sum(humanColumn) })
    .from(trackingRollupDaily)
    .where(
      and(
        eq(trackingRollupDaily.organizationId, organizationId),
        gte(trackingRollupDaily.date, range.from),
        lte(trackingRollupDaily.date, range.to),
      ),
    )
    .groupBy(trackingRollupDaily.date)
    .orderBy(desc(sum(humanColumn)))
    .limit(1);
  if (!best) return null;

  const prev = previousPeriod(range);
  const prevTotal = await sumRollupInRange(organizationId, eventType, prev);
  const prevDays = daysBetween(prev.from, prev.to);
  const prevAverage = prevDays > 0 ? prevTotal / prevDays : 0;
  const dayCount = Number(best.count ?? 0);
  return {
    date: best.date,
    count: dayCount,
    percentChange: percentChange(dayCount, prevAverage),
    previous: Math.round(prevAverage),
  };
}

// The country with the most interactions in range; its percentChange compares that same
// country's count against its own count in the previous period (a country not seen in the
// previous period reads as null, not +∞% or +100%).
export async function getOrgBestLocation(
  organizationId: string,
  eventType: AnalyticsEventType,
  range: AnalyticsDateRange,
): Promise<{ country: string; count: number; percentChange: number | null; previous: number } | null> {
  const { from, to } = utcDayBounds(range);
  const [best] = await db
    .select({ country: trackingEvents.geoCountry, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(trackingEvents.geoCountry)
    .orderBy(desc(count()))
    .limit(1);
  if (!best || !best.country) return null;

  const { from: prevFrom, to: prevTo } = utcDayBounds(previousPeriod(range));
  const [prevRow] = await db
    .select({ count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        eq(trackingEvents.geoCountry, best.country),
        gte(trackingEvents.createdAt, prevFrom),
        lte(trackingEvents.createdAt, prevTo),
      ),
    );
  const previousCount = prevRow?.count ?? 0;
  return {
    country: best.country,
    count: best.count,
    percentChange: percentChange(best.count, previousCount),
    previous: previousCount,
  };
}

// Generalizes breakdownForLink from one link to the whole organization. Country and device
// return every row (no limit(5) like the per-link version) — the location table paginates
// client-side. Referrer keeps its null rows instead of discarding them (mapped to "Directo") —
// unlike device/country, "no referrer" is itself a meaningful, expected bucket here, not missing
// data.
async function orgBreakdown(
  organizationId: string,
  eventType: AnalyticsEventType,
  column: typeof trackingEvents.deviceType | typeof trackingEvents.geoCountry,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  const rows = await db
    .select({ label: column, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(column)
    .orderBy(desc(count()));
  return rows
    .filter((row) => row.label !== null)
    .map((row) => ({ label: row.label as string, count: row.count }));
}

async function orgReferrerBreakdown(
  organizationId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  const rows = await db
    .select({ label: trackingEvents.referrer, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(trackingEvents.referrer)
    .orderBy(desc(count()));
  return rows.map((row) => ({ label: row.label ?? "Directo", count: row.count }));
}

export type OrgBreakdowns = { devices: BreakdownRow[]; countries: BreakdownRow[]; referrers: BreakdownRow[] };

export async function getOrgBreakdowns(
  organizationId: string,
  eventType: AnalyticsEventType,
  from: Date,
  to: Date,
): Promise<OrgBreakdowns> {
  const [devices, countries, referrers] = await Promise.all([
    orgBreakdown(organizationId, eventType, trackingEvents.deviceType, from, to),
    orgBreakdown(organizationId, eventType, trackingEvents.geoCountry, from, to),
    orgReferrerBreakdown(organizationId, eventType, from, to),
  ]);
  return { devices, countries, referrers };
}

// Per-country region breakdown, fetched lazily (one call per expanded row in the location table)
// rather than bundled into getOrgBreakdowns — most countries in a given range are never expanded,
// so computing this eagerly for all of them would be wasted work on every dashboard load.
export async function getOrgRegionBreakdown(
  organizationId: string,
  eventType: AnalyticsEventType,
  country: string,
  from: Date,
  to: Date,
): Promise<BreakdownRow[]> {
  const rows = await db
    .select({ label: trackingEvents.region, count: count() })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.organizationId, organizationId),
        eq(trackingEvents.sourceType, eventType),
        eq(trackingEvents.geoCountry, country),
        gte(trackingEvents.createdAt, from),
        lte(trackingEvents.createdAt, to),
      ),
    )
    .groupBy(trackingEvents.region)
    .orderBy(desc(count()));
  return rows
    .filter((row) => row.label !== null)
    .map((row) => ({ label: row.label as string, count: row.count }));
}
