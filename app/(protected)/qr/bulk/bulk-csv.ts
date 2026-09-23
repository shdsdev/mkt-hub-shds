import { normalizeUtmValue } from "@/lib/utm";

export const BULK_QR_MAX_ROWS = 200;
export const BULK_QR_CSV_HEADER = [
  "url",
  "title",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

const reservedUtmKeys = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
]);

export type BulkQrUtmValues = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

export type BulkQrImportRow = { rowNumber: number; url: string; title: string } & BulkQrUtmValues;

export type BulkQrInvalidRow = BulkQrImportRow & {
  error: string;
};

export type BulkQrCsvPreview = {
  rows: BulkQrImportRow[];
  invalidRows: BulkQrInvalidRow[];
  fileError?: string;
};

type CsvRecord = { fields: string[]; lineNumber: number };

function tokenizeCsv(csv: string): { records: CsvRecord[]; error?: string } {
  const records: CsvRecord[] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let lineNumber = 1;
  let recordLineNumber = 1;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      record.push(field);
      field = "";
      continue;
    }

    if (character === "\n" && !quoted) {
      record.push(field);
      records.push({ fields: record, lineNumber: recordLineNumber });
      record = [];
      field = "";
      lineNumber += 1;
      recordLineNumber = lineNumber;
      continue;
    }

    field += character;
  }

  if (quoted) return { records, error: "El archivo CSV contiene comillas sin cerrar." };

  if (field || record.length > 0) {
    record.push(field);
    records.push({ fields: record, lineNumber: recordLineNumber });
  }

  return { records };
}

function normalizeOptionalUtm(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? normalizeUtmValue(trimmed) : undefined;
}

export function normalizeBulkQrRow(row: BulkQrImportRow): BulkQrImportRow {
  return {
    rowNumber: row.rowNumber,
    url: row.url.trim(),
    title: row.title.trim(),
    utmSource: normalizeOptionalUtm(row.utmSource ?? ""),
    utmMedium: normalizeOptionalUtm(row.utmMedium ?? ""),
    utmCampaign: normalizeOptionalUtm(row.utmCampaign ?? ""),
    utmTerm: normalizeOptionalUtm(row.utmTerm ?? ""),
    utmContent: normalizeOptionalUtm(row.utmContent ?? ""),
  };
}

export function destinationContainsReservedUtm(url: string): boolean {
  return [...new URL(url).searchParams.keys()].some((key) => reservedUtmKeys.has(key.toLowerCase()));
}

export function validateBulkQrRow(row: BulkQrImportRow): string | undefined {
  if (!row.title || row.title.length > 255) {
    return `La fila ${row.rowNumber} no tiene un título válido.`;
  }

  if (!row.url || row.url.length > 2048 || !/^https?:\/\//i.test(row.url)) {
    return `La fila ${row.rowNumber} tiene una URL inválida. Usa http:// o https://.`;
  }

  try {
    if (destinationContainsReservedUtm(row.url)) {
      return `La fila ${row.rowNumber} no puede incluir parámetros UTM en la URL.`;
    }

    for (const value of [row.utmSource, row.utmMedium, row.utmCampaign, row.utmTerm, row.utmContent]) {
      if (value) normalizeUtmValue(value);
    }
  } catch {
    return `La fila ${row.rowNumber} tiene un valor UTM inválido.`;
  }
}

export function parseBulkQrCsv(csv: string): BulkQrCsvPreview {
  const preview: BulkQrCsvPreview = { rows: [], invalidRows: [] };
  const { records, error } = tokenizeCsv(csv.replace(/\r\n?/g, "\n"));
  if (error) return { ...preview, fileError: error };

  const nonBlankRecords = records.filter((record) => record.fields.some((field) => field.trim()));
  if (nonBlankRecords.length === 0) return { ...preview, fileError: "El archivo está vacío." };

  const [header, ...dataRecords] = nonBlankRecords;
  if (!header.fields.every((field, index) => field === BULK_QR_CSV_HEADER[index]) || header.fields.length !== BULK_QR_CSV_HEADER.length) {
    return { ...preview, fileError: "El encabezado CSV debe coincidir exactamente con la plantilla." };
  }
  if (dataRecords.length === 0) return { ...preview, fileError: "El archivo no contiene filas para importar." };
  if (dataRecords.length > BULK_QR_MAX_ROWS) {
    return { ...preview, fileError: `El archivo no puede contener más de ${BULK_QR_MAX_ROWS} filas.` };
  }

  for (const record of dataRecords) {
    const rowNumber = record.lineNumber - header.lineNumber;
    const [url = "", title = "", utmSource = "", utmMedium = "", utmCampaign = "", utmTerm = "", utmContent = ""] = record.fields;
    const rawRow: BulkQrImportRow = { rowNumber, url: url.trim(), title: title.trim() };

    if (record.fields.length !== BULK_QR_CSV_HEADER.length) {
      preview.invalidRows.push({
        ...rawRow,
        error: `La fila ${rowNumber} debe contener exactamente siete columnas.`,
      });
      continue;
    }

    let row: BulkQrImportRow;
    try {
      row = normalizeBulkQrRow({ rowNumber, url, title, utmSource, utmMedium, utmCampaign, utmTerm, utmContent });
    } catch {
      preview.invalidRows.push({ ...rawRow, error: `La fila ${rowNumber} tiene un valor UTM inválido.` });
      continue;
    }

    const validationError = validateBulkQrRow(row);
    if (validationError) {
      preview.invalidRows.push({ ...row, error: validationError });
      continue;
    }

    preview.rows.push(row);
  }

  return preview.invalidRows.length > 0 ? { ...preview, rows: [] } : preview;
}
