import { describe, expect, it } from "vitest";
import { buildQuestionsCsv } from "./export";

const row = {
  createdAt: new Date("2026-10-16T12:00:00.000Z"),
  status: "answered",
  question: "¿Se puede exportar?",
  answer: "Sí, desde el panel.",
  votes: 3,
  topic: "Producto",
  fullName: "Ana Pérez",
  company: "Acme, S.A.",
};

describe("buildQuestionsCsv", () => {
  it("exports an anonymized projection without PII", () => {
    const csv = buildQuestionsCsv([row], false);

    expect(csv).toContain("fecha,estado,pregunta,respuesta,votos,tema");
    expect(csv).toContain("¿Se puede exportar?");
    expect(csv).not.toContain("Ana Pérez");
    expect(csv).not.toContain("Acme");
  });

  it("exports identity only when explicitly requested", () => {
    const csv = buildQuestionsCsv([row], true);

    expect(csv).toContain("nombre,empresa");
    expect(csv).toContain("Ana Pérez");
    expect(csv).toContain('"Acme, S.A."');
  });
});
