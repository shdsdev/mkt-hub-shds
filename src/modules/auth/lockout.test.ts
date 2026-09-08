import { describe, it, expect } from "vitest";
import { isLockedOut, recordFailedAttempt, recordSuccessfulLogin, MAX_ATTEMPTS, LOCK_DURATION_MS } from "./lockout";

describe("isLockedOut", () => {
  it("is not locked when lockedUntil is null", () => {
    expect(isLockedOut({ lockedUntil: null }, new Date())).toBe(false);
  });

  it("is locked when lockedUntil is in the future", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const future = new Date("2026-01-01T00:10:00Z");
    expect(isLockedOut({ lockedUntil: future }, now)).toBe(true);
  });

  it("is not locked when lockedUntil is in the past", () => {
    const now = new Date("2026-01-01T00:10:00Z");
    const past = new Date("2026-01-01T00:00:00Z");
    expect(isLockedOut({ lockedUntil: past }, now)).toBe(false);
  });
});

describe("recordFailedAttempt", () => {
  it("increments the attempt count without locking below the threshold", () => {
    const result = recordFailedAttempt(
      { failedLoginAttempts: 0, lockedUntil: null },
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(result.failedLoginAttempts).toBe(1);
    expect(result.lockedUntil).toBeNull();
  });

  it("locks the account once the attempt count reaches MAX_ATTEMPTS", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const result = recordFailedAttempt(
      { failedLoginAttempts: MAX_ATTEMPTS - 1, lockedUntil: null },
      now,
    );
    expect(result.failedLoginAttempts).toBe(MAX_ATTEMPTS);
    expect(result.lockedUntil).toEqual(new Date(now.getTime() + LOCK_DURATION_MS));
  });

  it("keeps extending the lock if a failed attempt arrives while already locked", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const result = recordFailedAttempt(
      { failedLoginAttempts: MAX_ATTEMPTS + 3, lockedUntil: now },
      now,
    );
    expect(result.lockedUntil).toEqual(new Date(now.getTime() + LOCK_DURATION_MS));
  });
});

describe("recordSuccessfulLogin", () => {
  it("resets the attempt count and clears the lock", () => {
    const result = recordSuccessfulLogin();
    expect(result).toEqual({ failedLoginAttempts: 0, lockedUntil: null });
  });
});
