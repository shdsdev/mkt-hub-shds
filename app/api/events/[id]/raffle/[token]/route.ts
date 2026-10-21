import { NextResponse } from "next/server";
import { drawNextRaffleStagePrize, getRaffleStageState } from "@/modules/raffles";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  const state = await getRaffleStageState(id, token);
  if (!state) return NextResponse.json({ error: "Pantalla no disponible." }, { status: 404 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;
  try {
    await drawNextRaffleStagePrize(id, token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar el sorteo.";
    return NextResponse.json({ error: message }, { status: message === "Stage not found" ? 404 : 409 });
  }
}
