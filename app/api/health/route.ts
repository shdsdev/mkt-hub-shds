import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/modules/monitoring";

export async function GET() {
  try {
    await checkDatabaseHealth();
    return NextResponse.json({ ok: true, service: "marketing-hub" });
  } catch {
    return NextResponse.json({ ok: false, service: "marketing-hub" }, { status: 503 });
  }
}
