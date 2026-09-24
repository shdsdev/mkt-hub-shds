import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  createUtmPresetAction: vi.fn(),
  updateUtmPresetAction: vi.fn(),
  archiveUtmPresetAction: vi.fn(),
  deleteUtmPresetAction: vi.fn(),
}));

import { groupByCategory, UtmPresetsForm } from "./utm-presets-form";

const preset = {
  id: "7a29aa2a-4e37-4b15-97a0-1aa6fef2f36d",
  organizationId: "org-1",
  name: "Instagram Story",
  description: null,
  utmSource: "instagram",
  utmMedium: "social",
  utmCampaign: "summer_2026",
  utmTerm: null,
  utmContent: "story",
  utmId: null,
  customParameters: [{ key: "qr_id", value: "qr_000382" }],
  status: "active" as const,
  createdBy: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sourceOptions = [
  {
    value: "google",
    label: "Google Ads",
    category: "search",
    status: "active" as const,
    recommendedWith: ["cpc"],
  },
  {
    value: "facebook",
    label: "Facebook",
    category: "social",
    status: "active" as const,
    recommendedWith: ["social"],
  },
];

const mediumOptions = [
  { value: "cpc", label: "CPC", category: "paid", status: "active" as const },
  { value: "social", label: "Social", category: "social", status: "active" as const },
];

describe("UtmPresetsForm template-manager boundary", () => {
  it("renders taxonomy controls and never destination/preview/generation controls", () => {
    const html = renderToStaticMarkup(
      <UtmPresetsForm
        presets={[]}
        campaigns={[]}
        sourceOptions={sourceOptions}
        mediumOptions={mediumOptions}
      />,
    );

    expect(html).toContain("Source");
    expect(html).toContain("Medium");
    expect(html).toContain("Guardar plantilla");

    for (const forbidden of [
      "URL",
      "destino",
      "Destino",
      "enlace corto",
      "código QR",
      "vista previa",
      "preview",
      "Short",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it("uses premium Select controls instead of native selects", () => {
    const html = renderToStaticMarkup(
      <UtmPresetsForm
        presets={[]}
        campaigns={[]}
        sourceOptions={sourceOptions}
        mediumOptions={mediumOptions}
      />,
    );

    expect(html).toContain('role="combobox"');
    expect(html).not.toContain("<select");
  });

  it("adds accessible help controls for UTM fields", () => {
    const html = renderToStaticMarkup(
      <UtmPresetsForm
        presets={[]}
        campaigns={[]}
        sourceOptions={sourceOptions}
        mediumOptions={mediumOptions}
      />,
    );

    for (const field of ["Source", "Medium", "Campaign", "Term", "Content", "ID", "Parámetros personalizados"]) {
      expect(html).toContain(`Ayuda sobre ${field}`);
    }
  });

  it("groups active taxonomy options by category", () => {
    expect(groupByCategory(sourceOptions)).toEqual([
      ["search", [sourceOptions[0]]],
      ["social", [sourceOptions[1]]],
    ]);
  });

  it("offers edit and permanent deletion controls for an existing template", () => {
    const html = renderToStaticMarkup(
      <UtmPresetsForm
        presets={[preset]}
        campaigns={[]}
        sourceOptions={sourceOptions}
        mediumOptions={mediumOptions}
      />,
    );

    expect(html).toContain("Editar");
    expect(html).toContain("Eliminar");
  });
});
