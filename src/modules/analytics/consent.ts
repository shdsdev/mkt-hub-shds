import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const ANALYTICS_CONSENT_COOKIE = "mh_analytics_consent";
export const ANALYTICS_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export type AnalyticsConsentState = "granted" | "denied";

type ConsentPayload = {
  v: 1;
  state: AnalyticsConsentState;
  issuedAt: number;
  expiresAt: number;
  consentId?: string;
};

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("base64url");
}

export function createConsentToken(
  state: AnalyticsConsentState,
  now = new Date(),
  secret: string,
  consentId?: string,
): string {
  const issuedAt = now.getTime();
  const payload: ConsentPayload = {
    v: 1,
    state,
    issuedAt,
    expiresAt: issuedAt + ANALYTICS_CONSENT_MAX_AGE_SECONDS * 1000,
    consentId: consentId ?? randomUUID(),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function getConsentIdFromToken(token: string, secret: string, now = new Date()): string | undefined {
  try {
    const [encodedPayload] = token.split(".");
    if (!encodedPayload || getConsentStateFromToken(token, secret, now) !== "granted") return undefined;
    const payload = JSON.parse(decode(encodedPayload)) as Partial<ConsentPayload>;
    return typeof payload.consentId === "string" ? payload.consentId : undefined;
  } catch {
    return undefined;
  }
}

export function verifyConsentToken(token: string, secret: string, now = new Date()): boolean {
  return getConsentStateFromToken(token, secret, now) === "granted";
}

export function getConsentStateFromToken(
  token: string,
  secret: string,
  now = new Date(),
): AnalyticsConsentState | undefined {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature || !secret) return undefined;

    const expectedSignature = sign(encodedPayload, secret);
    const actualBytes = Buffer.from(signature, "base64url");
    const expectedBytes = Buffer.from(expectedSignature, "base64url");
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return undefined;

    const payload = JSON.parse(decode(encodedPayload)) as Partial<ConsentPayload>;
    return payload.v === 1
      && (payload.state === "granted" || payload.state === "denied")
      && typeof payload.issuedAt === "number"
      && typeof payload.expiresAt === "number"
      && payload.expiresAt > now.getTime()
      ? payload.state
      : undefined;
  } catch {
    return undefined;
  }
}

export function hasAnalyticsConsent(
  request: Pick<NextRequest, "cookies">,
  secret: string,
  now = new Date(),
): boolean {
  const token = request.cookies.get(ANALYTICS_CONSENT_COOKIE)?.value;
  return token ? verifyConsentToken(token, secret, now) : false;
}

export function getAnalyticsConsentState(
  request: Pick<NextRequest, "cookies">,
  secret: string,
  now = new Date(),
): AnalyticsConsentState | undefined {
  const token = request.cookies.get(ANALYTICS_CONSENT_COOKIE)?.value;
  return token ? getConsentStateFromToken(token, secret, now) : undefined;
}

export function setAnalyticsConsentCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set({
    name: ANALYTICS_CONSENT_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ANALYTICS_CONSENT_MAX_AGE_SECONDS,
    path: "/",
  });
}
