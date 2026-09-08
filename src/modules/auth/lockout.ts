// Account-level lockout — distinct from Supabase Auth's own per-IP rate limiting/CAPTCHA. Closes
// the distributed-brute-force gap where many IPs each make a couple of attempts against one
// account. See docs/SPEC.md §18.
export const MAX_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

type LockState = { failedLoginAttempts: number; lockedUntil: Date | null };

export function isLockedOut(state: Pick<LockState, "lockedUntil">, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

export function recordFailedAttempt(state: LockState, now: Date): LockState {
  const failedLoginAttempts = state.failedLoginAttempts + 1;
  const lockedUntil =
    failedLoginAttempts >= MAX_ATTEMPTS
      ? new Date(now.getTime() + LOCK_DURATION_MS)
      : null;
  return { failedLoginAttempts, lockedUntil };
}

export function recordSuccessfulLogin(): LockState {
  return { failedLoginAttempts: 0, lockedUntil: null };
}
