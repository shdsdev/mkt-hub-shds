// Public surface of the `campaigns` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  createCampaign,
  listCampaigns,
  getCampaign,
  endCampaign,
  addLinkToCampaign,
  listLinkIdsForCampaign,
  recordPrintRun,
  getScanRateForShortLink,
  getScanRateForQrCode,
  type Campaign,
  type PrintRun,
  type RecordPrintRunInput,
} from "./service";
