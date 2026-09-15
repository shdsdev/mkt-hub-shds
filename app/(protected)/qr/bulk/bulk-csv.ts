export const BULK_QR_MAX_ROWS = 200;

export type BulkQrImportRow = {
  rowNumber: number;
  url: string;
  title: string;
};

export type BulkQrInvalidRow = BulkQrImportRow & {
  error: string;
};

export type BulkQrCsvPreview = {
  readyRows: BulkQrImportRow[];
  invalidRows: BulkQrInvalidRow[];
  excludedRows: BulkQrImportRow[];
  fileError?: string;
};

function tokenizeCsv(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

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
      records.push(record);
      record = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

export function normalizeBulkQrRow(row: BulkQrImportRow): BulkQrImportRow {
  return { rowNumber: row.rowNumber, url: row.url.trim(), title: row.title.trim() };
}

export function validateBulkQrRow(row: BulkQrImportRow): string | undefined {
  if (!row.title || row.title.length > 255) {
    return `La fila ${row.rowNumber} no tiene un título válido.`;
  }

  if (!row.url || row.url.length > 2048 || !/^https?:\/\//i.test(row.url)) {
    return `La fila ${row.rowNumber} tiene una URL inválida. Usa http:// o https://.`;
  }
}

export function parseBulkQrCsv(csv: string): BulkQrCsvPreview {
  const preview: BulkQrCsvPreview = { readyRows: [], invalidRows: [], excludedRows: [] };
  const records = tokenizeCsv(csv.replace(/\r\n?/g, "\n")).filter((record) =>
    record.some((field) => field.trim()),
  );

  if (records.length === 0) {
    preview.fileError = "El archivo está vacío.";
    return preview;
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) {
    preview.fileError = "El archivo no contiene filas para importar.";
    return preview;
  }

  for (let index = 0; index < dataRecords.length; index += 1) {
    const fields = dataRecords[index];
    const rowNumber = index + 1;
    const row = normalizeBulkQrRow({
      rowNumber,
      url: fields[0] ?? "",
      title: fields[1] ?? "",
    });

    if (rowNumber > BULK_QR_MAX_ROWS) {
      preview.excludedRows.push(row);
      continue;
    }

    if (fields.length !== 2) {
      preview.invalidRows.push({
        ...row,
        error: `La fila ${rowNumber} debe contener exactamente URL y título.`,
      });
      continue;
    }

    const error = validateBulkQrRow(row);
    if (error) {
      preview.invalidRows.push({ ...row, error });
      continue;
    }

    preview.readyRows.push(row);
  }

  return preview;
}
