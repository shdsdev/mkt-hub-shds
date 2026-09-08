import { customAlphabet } from "nanoid";

// DATABASE.md's slug CHECK constraint.
const SLUG_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export const SLUG_LENGTH = 7;

// Excludes visually ambiguous characters (0/O, 1/l/I) — printed QR/short links get read by
// humans off physical material.
const SLUG_ALPHABET =
  "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const nanoid = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

export function generateSlug(): string {
  return nanoid();
}
