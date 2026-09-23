import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkQrImportRow } from "./bulk/bulk-csv";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkRateLimit: vi.fn(),
  createLink: vi.fn(),
  createShortLink: vi.fn(),
  listDomains: vi.fn(),
  listFolders: vi.fn(),
  listCampaigns: vi.fn(),
  createDynamicQrCode: vi.fn(),
  createQrDesignTemplate: vi.fn(),
  normalizeUtmValue: vi.fn(),
  recordAudit: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/links", () => ({
  createLink: mocks.createLink,
  createShortLink: mocks.createShortLink,
  listDomains: mocks.listDomains,
  listFolders: mocks.listFolders,
}));
vi.mock("@/modules/qr", () => ({
  createDynamicQrCode: mocks.createDynamicQrCode,
  createQrDesignTemplate: mocks.createQrDesignTemplate,
}));
vi.mock("@/modules/audit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordAudit: mocks.recordAudit,
}));
vi.mock("@/modules/campaigns", () => ({
  createCampaign: vi.fn(),
  listCampaigns: mocks.listCampaigns,
}));
vi.mock("@/modules/utm", () => ({
  normalizeUtmValue: mocks.normalizeUtmValue,
  createUtmPreset: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createBulkWebsiteQrCodesAction } from "./actions";

const user = {
  id: "user-1",
  email: "operator@example.com",
  profile: { organizationId: "org-1" },
};
const domain = { id: "domain-1" };
const validRows = [
  { rowNumber: 1, url: "https://one.example", title: "Uno" },
  { rowNumber: 2, url: "https://two.example", title: "Dos" },
];
const validInput = {
  rows: validRows,
  folderId: "00000000-0000-4000-8000-000000000001",
  design: {
    backgroundColor: "#1c1213",
    foregroundColor: "#f7edee",
    errorCorrectionLevel: "M" as const,
    dotsType: "square" as const,
    cornersSquareType: "square" as const,
    cornersDotType: "square" as const,
  },
  saveAsTemplate: false,
};

function inputWithRows(rows: BulkQrImportRow[]) {
  return { ...validInput, rows };
}

describe("createBulkWebsiteQrCodesAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.listDomains.mockResolvedValue([domain]);
    mocks.listFolders.mockResolvedValue([{ id: validInput.folderId }]);
    mocks.listCampaigns.mockResolvedValue([]);
    mocks.normalizeUtmValue.mockImplementation((value: string) => value.toLowerCase().replace(/\s+/g, "-"));
    mocks.createLink.mockResolvedValue({ id: "link-1" });
    mocks.createShortLink.mockResolvedValue({ id: "short-1" });
    mocks.createDynamicQrCode.mockResolvedValue({ id: "qr-1" });
  });

  it("returns an empty-batch error without loading services", async () => {
    await expect(createBulkWebsiteQrCodesAction(inputWithRows([]))).resolves.toMatchObject({
      requested: 0,
      created: 0,
      failed: 0,
      results: [],
      error: "No hay filas válidas para crear.",
    });
    expect(mocks.listDomains).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated callers before rate limiting", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.redirect.mockImplementation(() => {
      throw new Error("redirect");
    });

    await expect(createBulkWebsiteQrCodesAction(validInput)).rejects.toThrow("redirect");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("rejects rate-limited callers without mutations", async () => {
    mocks.checkRateLimit.mockReturnValue(false);

    await expect(createBulkWebsiteQrCodesAction(validInput)).resolves.toMatchObject({
      error: "Demasiadas acciones. Inténtalo de nuevo en breve.",
      results: [],
    });
    expect(mocks.listDomains).not.toHaveBeenCalled();
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("loads domains once and stops when no domain exists", async () => {
    mocks.listDomains.mockResolvedValue([]);

    await expect(createBulkWebsiteQrCodesAction(validInput)).resolves.toMatchObject({
      error: "Primero agrega un dominio en la página de Enlaces.",
      results: [],
    });
    expect(mocks.listDomains).toHaveBeenCalledTimes(1);
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("revalidates submitted rows and reports invalid and duplicate source rows", async () => {
    const result = await createBulkWebsiteQrCodesAction(inputWithRows([
      { rowNumber: 1, url: "ftp://bad.example", title: "Uno" },
      { rowNumber: 1, url: "https://duplicate.example", title: "Dos" },
    ]));

    expect(result).toMatchObject({ requested: 2, created: 0, failed: 2 });
    expect(result.results).toEqual([
      {
        rowNumber: 1,
        title: "Uno",
        status: "failed",
        error: "La fila 1 tiene una URL inválida. Usa http:// o https://.",
      },
      {
        rowNumber: 1,
        title: "Dos",
        status: "failed",
        error: "La fila 1 está duplicada.",
      },
    ]);
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("preserves submitted source order when validation and creation results are mixed", async () => {
    const result = await createBulkWebsiteQrCodesAction(inputWithRows([
      validRows[0],
      { rowNumber: 2, url: "ftp://bad.example", title: "Dos" },
      { rowNumber: 3, url: "https://three.example", title: "Tres" },
    ]));

    expect(result.results.map((row) => row.rowNumber)).toEqual([1, 2, 3]);
  });

  it("creates rows sequentially with website defaults and audits each success", async () => {
    const callLog: string[] = [];
    mocks.createLink.mockImplementation(async () => {
      callLog.push("link");
      return { id: `link-${callLog.length}` };
    });
    mocks.createShortLink.mockImplementation(async () => {
      callLog.push("short");
      return { id: `short-${callLog.length}` };
    });
    mocks.createDynamicQrCode.mockImplementation(async () => {
      callLog.push("qr");
      return { id: `qr-${callLog.length}` };
    });
    mocks.recordAudit.mockImplementation(async () => {
      callLog.push("audit");
    });

    const result = await createBulkWebsiteQrCodesAction(inputWithRows([
      {
        rowNumber: 1,
        url: " https://one.example ",
        title: " Uno ",
        utmSource: "Google",
        utmTerm: "Blue Term",
        utmContent: "Hero",
      },
      validRows[1],
    ]));

    expect(callLog).toEqual(["link", "short", "qr", "audit", "link", "short", "qr", "audit"]);
    expect(mocks.createLink).toHaveBeenNthCalledWith(1, expect.objectContaining({
      organizationId: "org-1",
      destinationUrl: "https://one.example",
      utmSource: "google",
      utmTerm: "blue-term",
      utmContent: "hero",
    }));
    expect(mocks.createShortLink).toHaveBeenNthCalledWith(1, {
      organizationId: "org-1",
      linkId: "link-1",
      domainId: "domain-1",
    });
    expect(mocks.createDynamicQrCode).toHaveBeenNthCalledWith(1, expect.objectContaining({
      organizationId: "org-1",
      linkId: "link-1",
      shortLinkId: "short-2",
      name: "Uno",
      folderId: validInput.folderId,
      backgroundColor: "#1c1213",
      foregroundColor: "#f7edee",
      errorCorrectionLevel: "M",
      dotsType: "square",
      cornersSquareType: "square",
      cornersDotType: "square",
    }));
    expect(result).toMatchObject({ requested: 2, created: 2, failed: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/qr");
  });

  it("preserves partial successes and continues after a row failure", async () => {
    mocks.createShortLink
      .mockResolvedValueOnce({ id: "short-1" })
      .mockRejectedValueOnce(new Error("No se pudo acortar la URL."))
      .mockResolvedValueOnce({ id: "short-3" });
    mocks.createDynamicQrCode
      .mockResolvedValueOnce({ id: "qr-1" })
      .mockResolvedValueOnce({ id: "qr-3" });

    const result = await createBulkWebsiteQrCodesAction(inputWithRows([
      ...validRows,
      { rowNumber: 3, url: "https://three.example", title: "Tres" },
    ]));

    expect(result).toEqual({
      requested: 3,
      created: 2,
      failed: 1,
      results: [
        { rowNumber: 1, title: "Uno", status: "created", qrCodeId: "qr-1" },
        { rowNumber: 2, title: "Dos", status: "failed", error: "No se pudo acortar la URL." },
        { rowNumber: 3, title: "Tres", status: "created", qrCodeId: "qr-3" },
      ],
    });
    expect(mocks.recordAudit).toHaveBeenCalledTimes(2);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("creates no records when any submitted row fails server preflight", async () => {
    const result = await createBulkWebsiteQrCodesAction({
      ...validInput,
      rows: [
        validRows[0],
        { ...validRows[1], rowNumber: 2, url: "https://bad.example/?UTM_Source=x" },
      ],
    });

    expect(result).toMatchObject({ created: 0, failed: 2 });
    expect(mocks.createLink).not.toHaveBeenCalled();
    expect(mocks.createQrDesignTemplate).not.toHaveBeenCalled();
  });

  it("rejects a foreign campaign and both grouping IDs before mutations", async () => {
    mocks.listCampaigns.mockResolvedValue([]);

    await expect(
      createBulkWebsiteQrCodesAction({
        ...validInput,
        campaignId: "00000000-0000-4000-8000-000000000002",
      }),
    ).resolves.toMatchObject({ error: expect.any(String) });

    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("saves the template before starting sequential row creation", async () => {
    const callLog: string[] = [];
    mocks.createQrDesignTemplate.mockImplementation(async () => {
      callLog.push("template");
    });
    mocks.createLink.mockImplementation(async () => {
      callLog.push("link");
      return { id: "link-1" };
    });

    await createBulkWebsiteQrCodesAction({
      ...validInput,
      rows: [validRows[0]],
      saveAsTemplate: true,
      templateName: "  Campaña otoño  ",
    });

    expect(callLog).toEqual(["template", "link"]);
    expect(mocks.createQrDesignTemplate).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      name: "Campaña otoño",
      backgroundColor: "#1c1213",
    }));
  });

  it("starts no QR row when saving the template fails", async () => {
    mocks.createQrDesignTemplate.mockRejectedValue(new Error("No se pudo guardar la plantilla."));

    await expect(
      createBulkWebsiteQrCodesAction({
        ...validInput,
        rows: [validRows[0]],
        saveAsTemplate: true,
        templateName: "Plantilla",
      }),
    ).resolves.toMatchObject({ created: 0, error: "No se pudo guardar la plantilla." });

    expect(mocks.createLink).not.toHaveBeenCalled();
  });
});
