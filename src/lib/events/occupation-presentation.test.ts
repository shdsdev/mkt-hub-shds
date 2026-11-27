import { describe, expect, it } from "vitest";
import { getOccupationPresentation } from "./occupation-presentation";

describe("getOccupationPresentation", () => {
  it("returns a visible label and category color for each occupation", () => {
    expect(getOccupationPresentation("wholesaler")).toMatchObject({ label: "Mayorista", color: "orange" });
    expect(getOccupationPresentation("manufacturer")).toMatchObject({ label: "Fabricante", color: "blue" });
    expect(getOccupationPresentation("architect-decorator")).toMatchObject({ label: "Arquitecto / Decorador", color: "green" });
    expect(getOccupationPresentation("installer-technician")).toMatchObject({ label: "Instalador o técnico", color: "red" });
  });

  it("falls back to a neutral presentation for unknown occupations", () => {
    expect(getOccupationPresentation("unknown")).toMatchObject({ label: "Categoría no especificada", color: "neutral" });
  });

  it("uses the event-specific label and color when configured", () => {
    expect(getOccupationPresentation("vip-client", [
      { value: "vip-client", label: "Cliente VIP", color: "yellow", enabled: true },
    ])).toMatchObject({ label: "Cliente VIP", color: "yellow", className: "bg-yellow-500 text-black" });
  });

  it("presents a custom HEX color with inline styles and readable foreground", () => {
    expect(getOccupationPresentation("vip-client", [
      { value: "vip-client", label: "Cliente VIP", color: "#8B5CF6", enabled: true },
    ])).toMatchObject({
      label: "Cliente VIP",
      color: "#8B5CF6",
      style: { backgroundColor: "#8B5CF6", color: "#ffffff" },
    });
  });
});
