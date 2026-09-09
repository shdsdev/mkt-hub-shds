// Public surface of the `qr` module — the ONLY file other modules may import (ARCHITECTURE.md I-4).
export {
  createDynamicQrCode,
  createStaticQrCode,
  getQrCode,
  getQrCodeByLinkId,
  listQrCodes,
  archiveQrCode,
  exportQrPng,
  exportQrSvg,
  type QrCodeRow,
  type QrCustomization,
} from "./service";
export { type ErrorCorrectionLevel } from "./logo";
