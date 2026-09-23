import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utm", () => ({
  normalizeUtmValue(raw: string): string {
    if (raw.length > 255) throw new Error("UTM value is too long.");

    const normalized = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!normalized) throw new Error("UTM value is empty.");
    return normalized;
  },
}));

import { parseBulkQrCsv } from "./bulk-csv";

const header = "url,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content";

describe("parseBulkQrCsv", () => {
  it("accepts the exact seven-column header, quoted values, CRLF, and blank lines", () => {
    expect(
      parseBulkQrCsv(
        `${header}\r\n` +
          'https://a.example,"Launch, fall", Google , Email , Autumn , "blue, room" , CTA\r\n\r\n',
      ),
    ).toMatchObject({
      rows: [
        {
          rowNumber: 1,
          url: "https://a.example",
          title: "Launch, fall",
          utmSource: "google",
          utmMedium: "email",
          utmCampaign: "autumn",
          utmTerm: "blue-room",
          utmContent: "cta",
        },
      ],
      invalidRows: [],
    });
  });

  it("accepts escaped quotes and LF records", () => {
    expect(parseBulkQrCsv(`${header}\nhttps://a.example,"A ""quoted"" title",,,,,\n`).rows).toEqual([
      { rowNumber: 1, url: "https://a.example", title: 'A "quoted" title' },
    ]);
  });

  it("requires the exact lower-case header and keeps data rows out of the preview", () => {
    expect(parseBulkQrCsv(`URL,title,utm_source,utm_medium,utm_campaign,utm_term,utm_content\nhttps://a.example,QR,,,,,\n`)).toMatchObject({
      rows: [],
      invalidRows: [],
      fileError: expect.any(String),
    });
  });

  it("reports malformed unterminated quoting", () => {
    expect(parseBulkQrCsv(`${header}\nhttps://a.example,"Unfinished,,,,,\n`)).toMatchObject({
      rows: [],
      fileError: expect.any(String),
    });
  });

  it("reports every non-seven-field and invalid data row without returning valid rows", () => {
    const result = parseBulkQrCsv(
      `${header}\nhttps://valid.example,Valid,,,,,\nhttps://a.example,Missing,,,,\nftp://a.example,Invalid URL,,,,,\n`,
    );

    expect(result.rows).toEqual([]);
    expect(result.invalidRows).toHaveLength(2);
    expect(result.invalidRows.map((row) => row.rowNumber)).toEqual([2, 3]);
  });

  it("preserves one-based data row numbers through intervening blank lines", () => {
    expect(parseBulkQrCsv(`${header}\n\nhttps://a.example,QR,,,,,\n\nhttps://b.example,Second,,,,,\n`).rows).toEqual([
      { rowNumber: 2, url: "https://a.example", title: "QR" },
      { rowNumber: 4, url: "https://b.example", title: "Second" },
    ]);
  });

  it("rejects more than 200 data rows without returning a partial import", () => {
    const dataRows = Array.from({ length: 201 }, (_, index) => `https://example.com/${index},QR ${index},,,,,`);

    expect(parseBulkQrCsv(`${header}\n${dataRows.join("\n")}\n`)).toMatchObject({
      rows: [],
      invalidRows: [],
      fileError: expect.any(String),
    });
  });

  it("rejects invalid title, URL, UTM limits, and destination UTM parameters case-insensitively", () => {
    const longValue = "a".repeat(256);
    const result = parseBulkQrCsv(
      `${header}\nhttps://a.example,${"T".repeat(256)},,,,,\nhttps://a.example?UTM_Source=x,QR,,,,,\nhttps://a.example,QR,${longValue},,,,\n`,
    );

    expect(result.rows).toEqual([]);
    expect(result.invalidRows).toHaveLength(3);
  });
});
