import { createHash, randomBytes } from "node:crypto";

export function createQuestionPublicToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashQuestionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeQuestionText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
