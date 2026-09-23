import type { BulkQrCsvPreview } from "./bulk-csv";

export type { BulkQrCsvPreview } from "./bulk-csv";

export type BulkQrBatchConfiguration = {
  folderId?: string;
  campaignId?: string;
  saveAsTemplate: boolean;
  templateName: string;
};

export function validateBulkQrBatchConfiguration({
  folderId,
  campaignId,
  saveAsTemplate,
  templateName,
}: BulkQrBatchConfiguration): string | undefined {
  if (Boolean(folderId) === Boolean(campaignId)) {
    return "Selecciona exactamente una carpeta o campaña para el lote.";
  }
  if (saveAsTemplate && (!templateName.trim() || templateName.trim().length > 255)) {
    return "Ingresa un nombre de plantilla válido.";
  }
}

export function canAdvanceBulkQrWizard({
  preview,
  ...configuration
}: BulkQrBatchConfiguration & { preview: BulkQrCsvPreview | null }): boolean {
  return Boolean(
    preview &&
      !preview.fileError &&
      preview.invalidRows.length === 0 &&
      preview.rows.length > 0 &&
      !validateBulkQrBatchConfiguration(configuration),
  );
}
