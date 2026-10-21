"use client";

import { useEffect, useMemo, useState } from "react";
import type { RaffleStageState } from "@/modules/raffles";

function randomCode(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

export function StageScreen({ initialState, apiPath }: { initialState: RaffleStageState; apiPath: string }) {
  const [state, setState] = useState(initialState);
  const [revealedCount, setRevealedCount] = useState(initialState.draw ? initialState.draw.attendeeCode.length : 0);
  const [spinning, setSpinning] = useState(false);
  const [randomizedCode, setRandomizedCode] = useState("");
  const [drawing, setDrawing] = useState(false);
  const draw = state.draw;
  const drawCode = draw?.attendeeCode ?? "";
  const prize = useMemo(() => state.prizes.find((item) => item.id === draw?.prizeId) ?? state.prizes.find((item) => item.status !== "finished"), [draw?.prizeId, state.prizes]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response = await fetch(apiPath, { cache: "no-store" });
      if (response.ok) setState(await response.json() as RaffleStageState);
    }, 2000);
    return () => window.clearInterval(interval);
  }, [apiPath]);

  useEffect(() => {
    if (!drawCode) return;
    setSpinning(true);
    setRevealedCount(0);
    const spinTimer = window.setTimeout(() => setSpinning(false), 1200);
    const revealTimer = window.setInterval(() => setRevealedCount((count) => Math.min(count + 1, drawCode.length)), 280);
    return () => {
      window.clearTimeout(spinTimer);
      window.clearInterval(revealTimer);
    };
  }, [draw?.id, drawCode]);

  useEffect(() => {
    if (!spinning || !drawCode) return;
    const interval = window.setInterval(() => setRandomizedCode(randomCode(drawCode.length)), 80);
    return () => window.clearInterval(interval);
  }, [drawCode, spinning]);

  const visibleCode = spinning ? randomizedCode : draw ? `${draw.attendeeCode.slice(0, revealedCount)}${"•".repeat(Math.max(0, draw.attendeeCode.length - revealedCount))}` : "••••••••";
  const hasWinner = Boolean(draw && revealedCount >= draw.attendeeCode.length && !spinning);
  const canDraw = !drawing && (!draw || (draw.status !== "pending_reveal" && draw.status !== "revealed"));

  async function drawWinner() {
    if (!canDraw) return;
    setDrawing(true);
    await fetch(apiPath, { method: "POST" });
    setDrawing(false);
    const response = await fetch(apiPath, { cache: "no-store" });
    if (response.ok) setState(await response.json() as RaffleStageState);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0b0d12] px-6 py-12 text-white">
      <div className="w-full max-w-6xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.32em] text-lime-300">Sorteo en vivo</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">{state.event.name}</h1>
        <p className="mt-10 text-lg text-white/60">{prize ? `Premio: ${prize.name}` : "Preparando el siguiente premio…"}</p>
        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-12 shadow-2xl shadow-black/30 sm:px-12 sm:py-20">
          <p className="text-sm uppercase tracking-[0.24em] text-white/50">Código ganador</p>
          <p className="mt-6 font-mono text-6xl font-bold tracking-[0.18em] text-lime-300 sm:text-9xl">{visibleCode}</p>
          {hasWinner ? <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700"><p className="text-3xl font-semibold sm:text-5xl">{draw?.attendeeName}</p><p className="mt-3 text-xl text-white/65 sm:text-2xl">{draw?.attendeeCompany || "Participante ganador"}</p></div> : <p className="mt-12 text-xl text-white/50">El ganador aparecerá aquí</p>}
          <button type="button" onClick={() => void drawWinner()} disabled={!canDraw} className="mt-12 rounded-full bg-lime-300 px-8 py-3 text-base font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">{drawing ? "Preparando sorteo…" : draw && !canDraw ? "Confirma el ganador para continuar" : "Sortear ganador"}</button>
        </div>
        <p className="mt-8 text-sm text-white/40">El equipo puede controlar el sorteo desde el panel administrativo.</p>
      </div>
    </main>
  );
}
