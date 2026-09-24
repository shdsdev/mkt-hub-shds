import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../actions", () => ({
  createUtmPresetAction: vi.fn(),
  archiveUtmPresetAction: vi.fn(),
}));

import { groupByCategory, UtmPresetsForm } from "./utm-presets-form";

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

  it("groups active taxonomy options by category", () => {
    expect(groupByCategory(sourceOptions)).toEqual([
      ["search", [sourceOptions[0]]],
      ["social", [sourceOptions[1]]],
    ]);
  });
});
