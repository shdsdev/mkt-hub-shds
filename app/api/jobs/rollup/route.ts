import { NextResponse, type NextRequest } from "next/server";
import { runDailyRollup } from "@/modules/analytics";

// Called once daily by an external cron (Phase 7 design — no in-app scheduler process, keeps the
// single-container deployment model). Bearer-token guarded; never exposed to the browser bundle.
export async function POST(request: NextRequest) {
  const secret = process.env.ROLLUP_JOB_SECRET;
  if (!secret) {
    return new NextResponse("ROLLUP_JOB_SECRET is not configured.", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  await runDailyRollup();
  return NextResponse.json({ ok: true });
}
