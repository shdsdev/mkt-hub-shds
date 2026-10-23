import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  ANALYTICS_CONSENT_COOKIE,
  createConsentToken,
  getAnalyticsConsentState,
  setAnalyticsConsentCookie,
  type AnalyticsConsentState,
} from "@/modules/analytics";
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
  const response = new NextResponse(null, { status: 204 });
  setAnalyticsConsentCookie(response, createConsentToken(state, new Date(), secret));
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
  if (clientId) await cancelGa4OutboxForClient(clientId);
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
