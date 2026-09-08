import { randomUUID } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "mh_vid";
const SESSION_WINDOW_SECONDS = 30 * 60; // SPEC.md §21 — dedup window, no fingerprinting.

// First-party, short-lived, non-cross-site cookie — no device fingerprinting (I-8). Reuses the
// existing id if present so repeat scans/clicks within the session window share one visitor_hash.
export function resolveVisitor(request: NextRequest, response: NextResponse): string {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const visitorHash = existing ?? randomUUID();

  response.cookies.set(COOKIE_NAME, visitorHash, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_WINDOW_SECONDS,
    path: "/",
  });

  return visitorHash;
}
