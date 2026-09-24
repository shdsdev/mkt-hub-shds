// Public surface of the `analytics` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  trackRedirect,
  countEventsForShortLink,
  countEventsForQrCode,
  countEventsForQrCodes,
  countUniqueScansForQrCode,
  countQrScansForLink,
  countUniqueQrScansForLink,
  countUniqueEventsForLink,
  getAnalyticsTotalsForLink,
  runDailyRollup,
  getAnalyticsForLinkGrouped,
  getAnalyticsBreakdownsForLink,
  exportAnalyticsCsvForLink,
  getOrgTrafficLast30Days,
  getOrgTrendGrouped,
  getOrgTotals,
  getOrgBestDay,
  getOrgBestLocation,
  getOrgBreakdowns,
  getOrgRegionBreakdown,
  type AnalyticsGranularity,
  type AnalyticsBucket,
  type BreakdownRow,
  type OrgBreakdowns,
} from "./service";
export { resolveVisitor } from "./visitor";
export { normalizeReferrer } from "./referrer";
export { percentChange } from "./percent-change";
export {
  getAnalyticsSource,
  type AnalyticsEventType,
  type AnalyticsMetric,
  type AnalyticsSurface,
} from "./source";
export { utcDayBounds, previousPeriod, daysBetween, type AnalyticsDateRange } from "./date-range";
