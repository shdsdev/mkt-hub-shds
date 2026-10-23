import { env } from "@/lib/env";
import { runGa4Report } from "./google";

export type Ga4Metrics = {
  configured: boolean;
  available: boolean;
  eventCount: number;
  activeUsers: number;
  sessions: number;
};

const EMPTY_METRICS: Ga4Metrics = { configured: false, available: false, eventCount: 0, activeUsers: 0, sessions: 0 };
const REPORT_CACHE_TTL_MS = 5 * 60 * 1000;
const reportCache = new Map<string, { expiresAt: number; value: Ga4Metrics }>();

function metricValue(row: { metricValues?: Array<{ value?: string }> } | undefined, index: number): number {
  const value = row?.metricValues?.[index]?.value;
  const parsed = value ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getGa4MetricsForLink(
  linkId: string,
  sourceType: "qr_scan" | "link_click",
  startDate: string,
  endDate: string,
): Promise<Ga4Metrics> {
  if (!env.GA4_PROPERTY_ID || !env.GA4_SERVICE_ACCOUNT_EMAIL || !env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return EMPTY_METRICS;
  }

  const cacheKey = `link:${linkId}:${sourceType}:${startDate}:${endDate}`;
  const cached = reportCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const eventName = sourceType === "qr_scan" ? "mh_qr_scan" : "mh_short_link_click";
  try {
    const report = await runGa4Report(
      env.GA4_PROPERTY_ID,
      env.GA4_SERVICE_ACCOUNT_EMAIL,
      env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "activeUsers" }, { name: "sessions" }],
        dimensionFilter: { andGroup: { expressions: [
          { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: eventName } } },
          { filter: { fieldName: "customEvent:mh_link_key", stringFilter: { matchType: "EXACT", value: linkId } } },
        ] } },
      },
    ) as { rows?: Array<{ metricValues?: Array<{ value?: string }> }> };
    const row = report.rows?.[0];
    const value = { configured: true, available: true, eventCount: metricValue(row, 0), activeUsers: metricValue(row, 1), sessions: metricValue(row, 2) };
    reportCache.set(cacheKey, { expiresAt: Date.now() + REPORT_CACHE_TTL_MS, value });
    return value;
  } catch {
    return { configured: true, available: false, eventCount: 0, activeUsers: 0, sessions: 0 };
  }
}

export async function getGa4MetricsForOrganization(
  sourceType: "qr_scan" | "link_click",
  startDate: string,
  endDate: string,
): Promise<Ga4Metrics> {
  if (!env.GA4_PROPERTY_ID || !env.GA4_SERVICE_ACCOUNT_EMAIL || !env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return EMPTY_METRICS;
  }

  const cacheKey = `org:${sourceType}:${startDate}:${endDate}`;
  const cached = reportCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const eventName = sourceType === "qr_scan" ? "mh_qr_scan" : "mh_short_link_click";
  try {
    const report = await runGa4Report(
      env.GA4_PROPERTY_ID,
      env.GA4_SERVICE_ACCOUNT_EMAIL,
      env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY,
      {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "activeUsers" }, { name: "sessions" }],
        dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: eventName } } },
      },
    ) as { rows?: Array<{ metricValues?: Array<{ value?: string }> }> };
    const row = report.rows?.[0];
    const value = { configured: true, available: true, eventCount: metricValue(row, 0), activeUsers: metricValue(row, 1), sessions: metricValue(row, 2) };
    reportCache.set(cacheKey, { expiresAt: Date.now() + REPORT_CACHE_TTL_MS, value });
    return value;
  } catch {
    return { configured: true, available: false, eventCount: 0, activeUsers: 0, sessions: 0 };
  }
}
