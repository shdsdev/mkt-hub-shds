import { randomBytes } from "node:crypto";

// Crockford base32 (design.md "Backup code") — 32 chars, excludes I/L/O/U by construction so a
// human reading the code aloud at the door never confuses visually similar characters.
export const CROCKFORD_BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BACKUP_CODE_LENGTH = 8;

// 8-char, unique per event (enforced by `event_attendees_event_backup_code_unique` in db.ts);
// callers regenerate on a unique-constraint collision rather than this function retrying itself.
export function generateBackupCode(): string {
  const bytes = randomBytes(BACKUP_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < BACKUP_CODE_LENGTH; i += 1) {
    code += CROCKFORD_BASE32_ALPHABET[bytes[i] % CROCKFORD_BASE32_ALPHABET.length];
  }
  return code;
}

// Opaque pass/cancel token (design.md "Pass + cancel tokens") — same precedent as
// `src/modules/agents/tools/contracts.ts#createConfirmationToken`: unguessable, revocable by
// column update, no signing secret, no expiry clock.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

// The only normalization authority behind `event_attendees.email_normalized`, which the partial
// unique index (design.md "Active-email uniqueness") keys on.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
