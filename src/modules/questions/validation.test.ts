import { describe, expect, it } from "vitest";
import {
  QUESTION_MAX_LENGTH,
  questionAccessCodeSchema,
  questionParticipantSchema,
  questionTextSchema,
} from "./validation";

describe("questionAccessCodeSchema", () => {
  it("accepts a five-character access code case-insensitively", () => {
    expect(questionAccessCodeSchema.parse("ab2c3")).toBe("AB2C3");
  });

  it("rejects access codes that are not exactly five safe characters", () => {
    expect(() => questionAccessCodeSchema.parse("AB1234")).toThrow();
    expect(() => questionAccessCodeSchema.parse("AB0C3")).toThrow();
  });
});

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
