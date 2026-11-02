import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { processDueEmailCampaigns } from "@/modules/email-marketing";

export async function POST(request: NextRequest) {
  let secret: string;
  try {
    secret = env.MARKETING_HUB_SERVER_TOKEN;
  } catch {
    return new NextResponse("MARKETING_HUB_SERVER_TOKEN is not configured.", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const result = await processDueEmailCampaigns();
  return NextResponse.json({ ok: true, ...result });
}
