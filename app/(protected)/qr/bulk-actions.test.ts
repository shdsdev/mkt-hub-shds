import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  checkRateLimit: vi.fn(),
  createLink: vi.fn(),
  createShortLink: vi.fn(),
  listDomains: vi.fn(),
  createDynamicQrCode: vi.fn(),
  recordAudit: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/modules/links", () => ({
  createLink: mocks.createLink,
  createShortLink: mocks.createShortLink,
  listDomains: mocks.listDomains,
}));
vi.mock("@/modules/qr", () => ({ createDynamicQrCode: mocks.createDynamicQrCode }));
vi.mock("@/modules/audit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  recordAudit: mocks.recordAudit,
}));
// @ts-expect-error Vitest supports virtual modules, but its installed types omit this option.
vi.mock("@/modules/campaigns", () => ({ createCampaign: vi.fn() }), { virtual: true });
vi.mock("@/modules/utm", () => ({ normalizeUtmValue: vi.fn(), createUtmPreset: vi.fn() }));
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

describe("createBulkWebsiteQrCodesAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.checkRateLimit.mockReturnValue(true);
    mocks.listDomains.mockResolvedValue([domain]);
    mocks.createLink.mockResolvedValue({ id: "link-1" });
    mocks.createShortLink.mockResolvedValue({ id: "short-1" });
    mocks.createDynamicQrCode.mockResolvedValue({ id: "qr-1" });
  });

  it("returns an empty-batch error without loading services", async () => {
    await expect(createBulkWebsiteQrCodesAction([])).resolves.toMatchObject({
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

    await expect(createBulkWebsiteQrCodesAction(validRows)).rejects.toThrow("redirect");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("rejects rate-limited callers without mutations", async () => {
    mocks.checkRateLimit.mockReturnValue(false);

    await expect(createBulkWebsiteQrCodesAction(validRows)).resolves.toMatchObject({
      error: "Demasiadas acciones. Inténtalo de nuevo en breve.",
      results: [],
    });
    expect(mocks.listDomains).not.toHaveBeenCalled();
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("loads domains once and stops when no domain exists", async () => {
    mocks.listDomains.mockResolvedValue([]);

    await expect(createBulkWebsiteQrCodesAction(validRows)).resolves.toMatchObject({
      error: "Primero agrega un dominio en la página de Enlaces.",
      results: [],
    });
    expect(mocks.listDomains).toHaveBeenCalledTimes(1);
    expect(mocks.createLink).not.toHaveBeenCalled();
  });

  it("revalidates submitted rows and reports invalid and duplicate source rows", async () => {
    const result = await createBulkWebsiteQrCodesAction([
      { rowNumber: 1, url: "ftp://bad.example", title: "Uno" },
      { rowNumber: 1, url: "https://duplicate.example", title: "Dos" },
    ]);

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
    const result = await createBulkWebsiteQrCodesAction([
      validRows[0],
      { rowNumber: 2, url: "ftp://bad.example", title: "Dos" },
      { rowNumber: 3, url: "https://three.example", title: "Tres" },
    ]);

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

    const result = await createBulkWebsiteQrCodesAction([
      { rowNumber: 1, url: " https://one.example ", title: " Uno " },
      validRows[1],
    ]);

    expect(callLog).toEqual(["link", "short", "qr", "audit", "link", "short", "qr", "audit"]);
    expect(mocks.createLink).toHaveBeenNthCalledWith(1, {
      organizationId: "org-1",
      destinationUrl: "https://one.example",
    });
    expect(mocks.createShortLink).toHaveBeenNthCalledWith(1, {
      organizationId: "org-1",
      linkId: "link-1",
      domainId: "domain-1",
    });
    expect(mocks.createDynamicQrCode).toHaveBeenNthCalledWith(1, {
      organizationId: "org-1",
      linkId: "link-1",
      shortLinkId: "short-2",
      name: "Uno",
      backgroundColor: "#1c1213",
      foregroundColor: "#f7edee",
      errorCorrectionLevel: "M",
      dotsType: "square",
      cornersSquareType: "square",
      cornersDotType: "square",
    });
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

    const result = await createBulkWebsiteQrCodesAction([
      ...validRows,
      { rowNumber: 3, url: "https://three.example", title: "Tres" },
    ]);

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
});
