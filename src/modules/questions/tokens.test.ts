import { describe, expect, it } from "vitest";
import { createQuestionPublicToken, hashQuestionToken, normalizeQuestionText } from "./tokens";

describe("question tokens", () => {
  it("creates an opaque URL token separate from the human access code", () => {
    const token = createQuestionPublicToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toHaveLength(5);
  });

  it("hashes the same token deterministically without returning the token", () => {
    const token = "public-session-token";
    const hash = hashQuestionToken(token);

    expect(hash).toBe(hashQuestionToken(token));
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
  });

  it("normalizes question text for duplicate suggestions", () => {
    expect(normalizeQuestionText("  ¿Qué  incluye, el SERVICIO? ")).toBe("que incluye el servicio");
  });
});
