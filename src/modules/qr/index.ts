// Public surface of the `qr` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  createDynamicQrCode,
  createStaticQrCode,
  getQrCode,
  getQrCodeByLinkId,
  listQrCodes,
  listQrGroupAvailability,
  countActiveQrCodes,
  archiveQrCode,
  updateQrCodeName,
  exportQrPng,
  exportQrSvg,
  exportQrPdf,
  createQrDesignTemplate,
  listQrDesignTemplates,
  type QrCodeRow,
  type QrCodeListFilter,
  type QrCustomization,
  type QrGrouping,
  type QrShapeType,
  type QrCornerType,
  type QrDesignTemplateRow,
} from "./service";
export { type ErrorCorrectionLevel } from "./logo";
export { buildStaticPayload, type StaticPayloadInput } from "./static-payload";
export { qrDownloadFilename } from "./filename";
