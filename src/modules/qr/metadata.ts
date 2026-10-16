export const QR_DESCRIPTION_MAX_LENGTH = 160;

export function normalizeQrDescription(value: string | null | undefined): string | undefined {
  const description = value?.trim();
  if (!description || description.length > QR_DESCRIPTION_MAX_LENGTH) return undefined;
  return description;
}
