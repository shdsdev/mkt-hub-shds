import { describe, expect, it } from "vitest";
import { getOccupationPresentation } from "./occupation-presentation";

describe("getOccupationPresentation", () => {
  it("returns a visible label and category color for each occupation", () => {
    expect(getOccupationPresentation("distributor")).toMatchObject({ label: "Distribuidor", color: "orange" });
    expect(getOccupationPresentation("manufacturer")).toMatchObject({ label: "Fabricante", color: "blue" });
    expect(getOccupationPresentation("architect")).toMatchObject({ label: "Arquitecto", color: "green" });
    expect(getOccupationPresentation("decorator")).toMatchObject({ label: "Decorador", color: "yellow" });
    expect(getOccupationPresentation("installer-technician")).toMatchObject({ label: "Instalador o técnico", color: "red" });
  });

  it("falls back to a neutral presentation for unknown occupations", () => {
    expect(getOccupationPresentation("unknown")).toMatchObject({ label: "Categoría no especificada", color: "neutral" });
  });
});
