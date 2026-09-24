import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  limit: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: { insert: mocks.insert, update: mocks.update, select: mocks.select },
}));

import {
  normalizeTemplateValues,
  createUtmPreset,
  updateUtmPreset,
  listUtmPresets,
  listActiveUtmTemplates,
  getActiveUtmTemplate,
  archiveUtmPreset,
} from "./service";

const legacyRow = {
  id: "preset-1",
  organizationId: "org-1",
  name: "Legacy",
  description: null,
  utmSource: "facebook-ads",
  utmMedium: "social-post",
  utmCampaign: "summer",
  utmTerm: null,
  utmContent: null,
  utmId: null,
  customParameters: [],
  status: "active",
  createdBy: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("normalizeTemplateValues", () => {
  it("normalizes standard values to snake_case and nulls empty optionals", () => {
    const values = normalizeTemplateValues({
      name: "  Summer Launch  ",
      description: "  A campaign  ",
      utmSource: "Facebook",
      utmMedium: "Paid Social",
      utmCampaign: "Summer Launch",
      utmTerm: "",
      utmContent: undefined,
      utmId: "Campaign-2026",
    });

    expect(values.name).toBe("Summer Launch");
    expect(values.description).toBe("A campaign");
    expect(values.utmSource).toBe("facebook");
    expect(values.utmMedium).toBe("paid_social");
    expect(values.utmCampaign).toBe("summer_launch");
    expect(values.utmTerm).toBeNull();
    expect(values.utmContent).toBeNull();
    expect(values.utmId).toBe("campaign_2026");
    expect(values.customParameters).toEqual([]);
    expect(values.status).toBe("active");
  });

  it("rejects a source outside the active taxonomy in controlled mode", () => {
    expect(() =>
      normalizeTemplateValues({
        name: "X",
        utmSource: "made-up-source",
        utmMedium: "social",
        utmCampaign: "c",
      }),
    ).toThrow();
  });

  it("accepts a custom partner source and normalizes it", () => {
    const values = normalizeTemplateValues({
      name: "Partner",
      utmSource: "My Partner Agency",
      utmMedium: "social",
      utmCampaign: "c",
      sourceMode: "partner",
    });
    expect(values.utmSource).toBe("my_partner_agency");
  });

  it("rejects reserved custom keys and reports warnings for non-recommended pairs", () => {
    expect(() =>
      normalizeTemplateValues({
        name: "X",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "c",
        customParameters: [{ key: "utm_source", value: "evil" }],
      }),
    ).toThrow();

    const warned = normalizeTemplateValues({
      name: "X",
      utmSource: "google",
      utmMedium: "email",
      utmCampaign: "c",
    });
    expect(warned.warnings.length).toBeGreaterThan(0);
  });
});

describe("utm service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("createUtmPreset inserts normalized values with creator and status", async () => {
    mocks.returning.mockResolvedValue([legacyRow]);
    mocks.values.mockReturnValue({ returning: mocks.returning });
    mocks.insert.mockReturnValue({ values: mocks.values });

    await createUtmPreset({
      organizationId: "org-1",
      name: "Google CPC",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "Spring",
      createdBy: "user-1",
      status: "draft",
    });

    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "spring",
        createdBy: "user-1",
        status: "draft",
      }),
    );
  });

  it("listUtmPresets returns legacy rows unchanged", async () => {
    mocks.where.mockResolvedValue([legacyRow]);
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    const rows = await listUtmPresets("org-1");
    expect(rows[0].utmSource).toBe("facebook-ads");
  });

  it("listActiveUtmTemplates maps rows to applyable templates", async () => {
    mocks.where.mockResolvedValue([legacyRow]);
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    const templates = await listActiveUtmTemplates("org-1");
    expect(templates).toHaveLength(1);
    expect(templates[0]).toEqual({
      id: "preset-1",
      name: "Legacy",
      utmSource: "facebook-ads",
      utmMedium: "social-post",
      utmCampaign: "summer",
      utmTerm: null,
      utmContent: null,
      utmId: null,
      customParameters: [],
    });
  });

  it("getActiveUtmTemplate returns undefined when no matching row", async () => {
    mocks.limit.mockResolvedValue([]);
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    await expect(getActiveUtmTemplate("missing", "org-1")).resolves.toBeUndefined();
  });

  it("archiveUtmPreset sets archived status and updatedAt", async () => {
    mocks.returning.mockResolvedValue([{ ...legacyRow, status: "archived" }]);
    mocks.where.mockReturnValue({ returning: mocks.returning });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });

    const archived = await archiveUtmPreset("preset-1", "org-1");
    expect(archived.status).toBe("archived");
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ status: "archived" }));
  });

  it("updateUtmPreset throws when the template is outside the organization", async () => {
    mocks.limit.mockResolvedValue([]);
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    await expect(
      updateUtmPreset({ id: "preset-1", organizationId: "org-2", name: "Hijack" }),
    ).rejects.toThrow();
  });
});
