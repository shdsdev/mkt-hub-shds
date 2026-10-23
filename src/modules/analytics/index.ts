// Public surface of the `analytics` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  trackRedirect,
  cancelGa4OutboxForClient,
  flushTrackingEvents,
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
export { buildTrackingEvent, type TrackRedirectInput } from "./tracking-event";
export { processGa4Outbox, type ProcessGa4OutboxResult } from "./outbox";
export { getGa4MetricsForLink, getGa4MetricsForOrganization, type Ga4Metrics } from "./reports";
export { resolveVisitor } from "./visitor";
export {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_CONSENT_MAX_AGE_SECONDS,
  createConsentToken,
  getAnalyticsConsentState,
  getConsentStateFromToken,
  hasAnalyticsConsent,
  setAnalyticsConsentCookie,
  verifyConsentToken,
  type AnalyticsConsentState,
} from "./consent";
export { normalizeReferrer } from "./referrer";
export { percentChange } from "./percent-change";
export {
  getAnalyticsSource,
  type AnalyticsEventType,
  type AnalyticsMetric,
  type AnalyticsSurface,
} from "./source";
export { utcDayBounds, previousPeriod, daysBetween, type AnalyticsDateRange } from "./date-range";
