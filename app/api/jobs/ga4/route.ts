import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { processGa4Outbox } from "@/modules/analytics";

export async function POST(request: NextRequest) {
  const secret = env.GA4_JOB_SECRET;
  if (!secret) return new NextResponse("GA4_JOB_SECRET is not configured.", { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });

  const result = await processGa4Outbox();
  return NextResponse.json({ ok: true, ...result });
}
