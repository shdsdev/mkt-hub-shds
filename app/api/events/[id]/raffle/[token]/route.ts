import { NextResponse } from "next/server";
import { getRaffleStageState } from "@/modules/raffles";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const state = await getRaffleStageState(id, token);
  if (!state) return NextResponse.json({ error: "Pantalla no disponible." }, { status: 404 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
