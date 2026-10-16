import { createHash } from "node:crypto";

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
