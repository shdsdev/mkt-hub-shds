import { describe, expect, it } from "vitest";
import {
  canAdvanceBulkQrWizard,
  validateBulkQrBatchConfiguration,
  type BulkQrCsvPreview,
} from "./bulk-wizard-state";

const validPreview: BulkQrCsvPreview = {
  rows: [{ rowNumber: 1, url: "https://a.example", title: "QR" }],
  invalidRows: [],
};

describe("validateBulkQrBatchConfiguration", () => {
  it("requires exactly one shared group", () => {
    expect(
      validateBulkQrBatchConfiguration({
        folderId: "folder-1",
        campaignId: "campaign-1",
        saveAsTemplate: false,
        templateName: "",
      }),
    ).toBe("Selecciona exactamente una carpeta o campaña para el lote.");
    expect(
      validateBulkQrBatchConfiguration({
        saveAsTemplate: false,
        templateName: "",
      }),
    ).toBe("Selecciona exactamente una carpeta o campaña para el lote.");
  });

  it("requires a non-empty template name up to 255 characters when saving a template", () => {
    expect(
      validateBulkQrBatchConfiguration({
        folderId: "folder-1",
        saveAsTemplate: true,
        templateName: "  ",
      }),
    ).toBe("Ingresa un nombre de plantilla válido.");
    expect(
      validateBulkQrBatchConfiguration({
        campaignId: "campaign-1",
        saveAsTemplate: true,
        templateName: "a".repeat(256),
      }),
    ).toBe("Ingresa un nombre de plantilla válido.");
  });
});

describe("canAdvanceBulkQrWizard", () => {
  it("blocks configuration without exactly one shared group", () => {
    expect(
      canAdvanceBulkQrWizard({
        preview: validPreview,
        folderId: "folder-1",
        campaignId: "campaign-1",
        saveAsTemplate: false,
        templateName: "",
      }),
    ).toBe(false);
    expect(
      canAdvanceBulkQrWizard({ preview: validPreview, saveAsTemplate: false, templateName: "" }),
    ).toBe(false);
  });

  it("accepts a valid preview and configuration only", () => {
    expect(
      canAdvanceBulkQrWizard({
        preview: validPreview,
        folderId: "folder-1",
        saveAsTemplate: true,
        templateName: "Launch batch",
      }),
    ).toBe(true);
    expect(
      canAdvanceBulkQrWizard({
        preview: { ...validPreview, invalidRows: [{ ...validPreview.rows[0], error: "Invalid" }] },
        folderId: "folder-1",
        saveAsTemplate: false,
        templateName: "",
      }),
    ).toBe(false);
    expect(
      canAdvanceBulkQrWizard({
        preview: { rows: [], invalidRows: [] },
        campaignId: "campaign-1",
        saveAsTemplate: false,
        templateName: "",
      }),
    ).toBe(false);
    expect(
      canAdvanceBulkQrWizard({
        preview: { ...validPreview, fileError: "Bad file" },
        campaignId: "campaign-1",
        saveAsTemplate: false,
        templateName: "",
      }),
    ).toBe(false);
  });
});
