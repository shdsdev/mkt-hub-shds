import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  ANALYTICS_CONSENT_COOKIE,
  createConsentToken,
  getConsentIdFromToken,
  getAnalyticsConsentState,
  setAnalyticsConsentCookie,
  type AnalyticsConsentState,
} from "@/modules/analytics";
import { createAnalyticsConsent, revokeAnalyticsConsent } from "@/modules/analytics";
import { cancelGa4OutboxForClient } from "@/modules/analytics";

export async function POST(request: NextRequest) {
  const secret = env.ANALYTICS_CONSENT_SECRET;
  if (!secret) return new NextResponse("Analytics consent is not configured.", { status: 503 });

  let body: { state?: unknown };
  try {
    body = (await request.json()) as { state?: unknown };
  } catch {
    return new NextResponse("Invalid JSON.", { status: 400 });
  }

  if (body.state !== "granted" && body.state !== "denied") {
    return new NextResponse("Invalid consent state.", { status: 400 });
  }

  const state = body.state as AnalyticsConsentState;
  const clientId = request.cookies.get("mh_vid")?.value ?? crypto.randomUUID();
  const existingToken = request.cookies.get(ANALYTICS_CONSENT_COOKIE)?.value;
  const existingConsentId = existingToken ? getConsentIdFromToken(existingToken, secret) : undefined;
  if (existingConsentId) await revokeAnalyticsConsent(existingConsentId);
  else if (existingToken && clientId) await cancelGa4OutboxForClient(clientId);
  const consent = state === "granted" ? await createAnalyticsConsent(clientId) : undefined;
  const response = new NextResponse(null, { status: 204 });
  setAnalyticsConsentCookie(response, createConsentToken(state, new Date(), secret, consent?.id));
  if (!request.cookies.get("mh_vid")) response.cookies.set("mh_vid", clientId, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 180, path: "/" });
  return response;
}

export async function GET(request: NextRequest) {
  const secret = env.ANALYTICS_CONSENT_SECRET;
  return NextResponse.json({
    state: secret ? getAnalyticsConsentState(request, secret) : undefined,
  });
}

export async function DELETE(request: NextRequest) {
  const clientId = request.cookies.get("mh_vid")?.value;
  const secret = env.ANALYTICS_CONSENT_SECRET;
  const consentToken = request.cookies.get(ANALYTICS_CONSENT_COOKIE)?.value;
  const consentId = secret && consentToken ? getConsentIdFromToken(consentToken, secret) : undefined;
  if (consentId) await revokeAnalyticsConsent(consentId);
  else if (clientId) await cancelGa4OutboxForClient(clientId);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: ANALYTICS_CONSENT_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  });
  return response;
}
