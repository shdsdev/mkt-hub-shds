import { describe, expect, it } from "vitest";
import {
  QUESTION_MAX_LENGTH,
  questionParticipantSchema,
  questionTextSchema,
} from "./validation";

describe("questionTextSchema", () => {
  it("trims valid question text", () => {
    expect(questionTextSchema.parse("  ¿Qué incluye el servicio?  ")).toBe("¿Qué incluye el servicio?");
  });

  it("rejects empty and oversized questions", () => {
    expect(() => questionTextSchema.parse("   ")).toThrow();
    expect(() => questionTextSchema.parse("x".repeat(QUESTION_MAX_LENGTH + 1))).toThrow();
  });
});

describe("questionParticipantSchema", () => {
  it("requires identity and explicit consent", () => {
    expect(() =>
      questionParticipantSchema.parse({
        fullName: "Ana Pérez",
        company: "Acme",
        consentAccepted: false,
      }),
    ).toThrow();
  });

  it("normalizes participant fields", () => {
    expect(
      questionParticipantSchema.parse({
        fullName: "  Ana Pérez  ",
        company: "  Acme  ",
        consentAccepted: true,
      }),
    ).toEqual({ fullName: "Ana Pérez", company: "Acme", consentAccepted: true });
  });
});
