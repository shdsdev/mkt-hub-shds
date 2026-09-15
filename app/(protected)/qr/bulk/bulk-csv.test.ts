import { describe, expect, it } from "vitest";
import { parseBulkQrCsv } from "./bulk-csv";

describe("parseBulkQrCsv", () => {
  it("parses quoted fields, CRLF records, and skips blank lines", () => {
    const result = parseBulkQrCsv(
      "URL,Titulo del codigo QR (referencia)\r\n" +
        'https://a.example,"Lanzamiento, otoño"\r\n' +
        "\r\n" +
        "http://b.example,Segundo QR\r\n",
    );

    expect(result).toEqual({
      readyRows: [
        { rowNumber: 1, url: "https://a.example", title: "Lanzamiento, otoño" },
        { rowNumber: 2, url: "http://b.example", title: "Segundo QR" },
      ],
      invalidRows: [],
      excludedRows: [],
    });
  });

  it("reports a whitespace-only title", () => {
    expect(parseBulkQrCsv("URL,Titulo\nhttps://a.example,   \n").invalidRows).toEqual([
      {
        rowNumber: 1,
        url: "https://a.example",
        title: "",
        error: "La fila 1 no tiene un título válido.",
      },
    ]);
  });

  it("reports a URL without an HTTP scheme", () => {
    expect(parseBulkQrCsv("URL,Titulo\nftp://a.example,Uno\n").invalidRows).toEqual([
      {
        rowNumber: 1,
        url: "ftp://a.example",
        title: "Uno",
        error: "La fila 1 tiene una URL inválida. Usa http:// o https://.",
      },
    ]);
  });

  it("reports a record without exactly two fields", () => {
    expect(parseBulkQrCsv("URL,Titulo\nhttps://a.example\n").invalidRows).toEqual([
      {
        rowNumber: 1,
        url: "https://a.example",
        title: "",
        error: "La fila 1 debe contener exactamente URL y título.",
      },
    ]);
  });

  it("reports an empty file", () => {
    expect(parseBulkQrCsv("").fileError).toBe("El archivo está vacío.");
  });

  it("reports a header-only file", () => {
    expect(parseBulkQrCsv("URL,Titulo\n\n").fileError).toBe("El archivo no contiene filas para importar.");
  });

  it("reports extra fields before validating their values", () => {
    expect(parseBulkQrCsv("URL,Titulo\nhttps://a.example,Uno,Extra\n").invalidRows[0]?.error).toBe(
      "La fila 1 debe contener exactamente URL y título.",
    );
  });

  it("excludes data after the 200-row limit", () => {
    const rows = Array.from(
      { length: 201 },
      (_, index) => `https://example.com/${index + 1},QR ${index + 1}`,
    );
    const result = parseBulkQrCsv(`URL,Titulo\n${rows.join("\n")}\n`);

    expect(result.readyRows).toHaveLength(200);
    expect(result.invalidRows).toEqual([]);
    expect(result.excludedRows).toEqual([
      { rowNumber: 201, url: "https://example.com/201", title: "QR 201" },
    ]);
  });
});
