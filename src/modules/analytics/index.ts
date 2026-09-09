// Public surface of the `analytics` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  trackRedirect,
  countEventsForShortLink,
  countEventsForQrCode,
  countUniqueScansForQrCode,
  countQrScansForLink,
  countUniqueQrScansForLink,
  runDailyRollup,
  getRollupForLink,
  getRollupTotalsForLink,
  getScansForLinkGrouped,
  getDeviceBreakdownForLink,
  getCountryBreakdownForLink,
  getCityBreakdownForLink,
  exportRollupCsvForLink,
  getOrgTrafficLast30Days,
  type RollupTotals,
  type ScanGranularity,
  type ScanBucket,
  type BreakdownRow,
} from "./service";
export { resolveVisitor } from "./visitor";
export { type RollupRow } from "./csv";
