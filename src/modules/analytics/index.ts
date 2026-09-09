// Public surface of the `analytics` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  trackRedirect,
  countEventsForShortLink,
  countEventsForQrCode,
  runDailyRollup,
  getRollupForLink,
  getRollupTotalsForLink,
  exportRollupCsvForLink,
  type RollupTotals,
} from "./service";
export { resolveVisitor } from "./visitor";
export { type RollupRow } from "./csv";
