import { describe, expect, it } from "vitest";
import { parseRegistrationFormAnswers } from "./registration-form-answers";
import type { RegistrationCustomField } from "@/modules/events";

const fields: RegistrationCustomField[] = [
  { id: "company-size", type: "select_multiple", label: "Tamaño", description: "", required: true, enabled: true, position: 0, section: "personal", options: [{ value: "small", label: "Pequeña" }, { value: "large", label: "Grande" }] },
  { id: "employees", type: "number", label: "Empleados", description: "", required: false, enabled: true, position: 1, section: "personal", min: 1, max: 1000 },
  { id: "contact-ok", type: "checkbox", label: "Contacto", description: "", required: true, enabled: true, position: 2, section: "personal" },
];

function data(entries: [string, string][]) {
  const formData = new FormData();
  for (const [key, value] of entries) formData.append(key, value);
  return formData;
}

describe("parseRegistrationFormAnswers", () => {
  it("normalizes valid answers and preserves field metadata", () => {
    const result = parseRegistrationFormAnswers(fields, data([
      ["company-size", "small"],
      ["company-size", "large"],
      ["employees", "12"],
      ["contact-ok", "true"],
    ]));

    expect(result).toEqual({
      ok: true,
      answers: {
        "company-size": { label: "Tamaño", type: "select_multiple", value: ["small", "large"] },
        employees: { label: "Empleados", type: "number", value: 12 },
        "contact-ok": { label: "Contacto", type: "checkbox", value: true },
      },
    });
  });

  it("rejects required, invalid option, duplicate, and out-of-range answers", () => {
    expect(parseRegistrationFormAnswers(fields, data([["employees", "12"], ["contact-ok", "true"]]))).toMatchObject({ ok: false });
    expect(parseRegistrationFormAnswers(fields, data([["company-size", "unknown"], ["contact-ok", "true"]]))).toMatchObject({ ok: false });
    expect(parseRegistrationFormAnswers(fields, data([["company-size", "small"], ["company-size", "small"], ["contact-ok", "true"]]))).toMatchObject({ ok: false });
    expect(parseRegistrationFormAnswers(fields, data([["company-size", "small"], ["employees", "0"], ["contact-ok", "true"]]))).toMatchObject({ ok: false });
  });

  it("ignores disabled fields and rejects unknown field ids", () => {
    const disabled: RegistrationCustomField[] = [{ ...fields[0], enabled: false }];
    expect(parseRegistrationFormAnswers(disabled, data([["company-size", "small"]]))).toEqual({ ok: true, answers: {} });
    expect(parseRegistrationFormAnswers(fields, data([["unknown", "value"], ["company-size", "small"], ["contact-ok", "true"]]))).toMatchObject({ ok: false });
  });

  it("ignores Server Action metadata while rejecting unknown user fields", () => {
    expect(parseRegistrationFormAnswers(fields, data([
      ["$ACTION_ID_example", "server-action"],
      ["company-size", "small"],
      ["company-size", "large"],
      ["employees", "12"],
      ["contact-ok", "true"],
    ]))).toMatchObject({ ok: true });

    expect(parseRegistrationFormAnswers(fields, data([
      ["unexpected-field", "value"],
      ["company-size", "small"],
      ["company-size", "large"],
      ["employees", "12"],
      ["contact-ok", "true"],
    ])).ok).toBe(false);
  });

  it("returns the invalid custom field identifier for inline errors", () => {
    const result = parseRegistrationFormAnswers(fields, data([
      ["company-size", "small"],
      ["company-size", "large"],
      ["employees", "not-a-number"],
      ["contact-ok", "true"],
    ]));

    expect(result).toEqual({
      ok: false,
      error: "Empleados: debe ser un número válido dentro del rango permitido.",
      fieldErrors: { employees: "debe ser un número válido dentro del rango permitido." },
    });
  });
});
