import { describe, expect, it } from "vitest";
import { describeSegmentCondition, describeSegmentFilters } from "./segment-presentation";

describe("email segment presentation", () => {
  it("translates stored conditions into plain-language copy", () => {
    expect(describeSegmentCondition({ field: "fullName", operator: "contains", value: "Sofía" })).toBe("Nombre completo contiene Sofía");
  });

  it("describes whether all or any rules must match", () => {
    expect(describeSegmentFilters({ logic: "any", conditions: [{ field: "email", operator: "contains", value: "@empresa.com" }, { field: "tag", operator: "has", value: "cliente" }] })).toBe("Correo electrónico contiene @empresa.com o Etiqueta tiene cliente");
  });
});
