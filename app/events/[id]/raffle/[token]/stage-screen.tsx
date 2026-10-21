"use client";
/* eslint-disable @next/next/no-img-element -- the stage logo is an administrator-configured external URL. */

import { useEffect, useMemo, useState } from "react";
import type { RaffleStageState } from "@/modules/raffles";
import { DEFAULT_RAFFLE_STAGE_THEME } from "@/lib/raffle-stage-theme";

function randomCode(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

const CONFETTI_PIECES = [
  ["8%", "18%", "-18deg", "0ms"], ["18%", "34%", "12deg", "90ms"], ["28%", "16%", "28deg", "180ms"],
  ["39%", "30%", "-8deg", "260ms"], ["51%", "14%", "20deg", "120ms"], ["62%", "32%", "-24deg", "320ms"],
  ["73%", "18%", "14deg", "210ms"], ["84%", "36%", "-12deg", "60ms"], ["92%", "20%", "24deg", "280ms"],
  ["13%", "66%", "22deg", "240ms"], ["24%", "78%", "-16deg", "40ms"], ["35%", "62%", "10deg", "300ms"],
  ["67%", "68%", "-20deg", "150ms"], ["78%", "80%", "18deg", "360ms"], ["89%", "64%", "-8deg", "200ms"],
] as const;

export function StageScreen({ initialState, apiPath }: { initialState: RaffleStageState; apiPath: string }) {
  const [state, setState] = useState(initialState);
  const [revealedCount, setRevealedCount] = useState(initialState.draw ? initialState.draw.attendeeCode.length : 0);
  const [spinning, setSpinning] = useState(false);
  const [randomizedCode, setRandomizedCode] = useState("");
  const [mounted, setMounted] = useState(false);
  const draw = state.draw;
  const drawCode = draw?.attendeeCode ?? "";
  const prize = useMemo(() => state.prizes.find((item) => item.id === draw?.prizeId) ?? state.prizes.find((item) => item.status !== "finished"), [draw?.prizeId, state.prizes]);
  const theme = state.theme ?? DEFAULT_RAFFLE_STAGE_THEME;
  const stageStyle = {
    "--stage-background": theme.backgroundColor,
    "--stage-accent": theme.accentColor,
    "--stage-foreground": theme.foregroundColor,
    "--stage-accent-foreground": theme.accentForegroundColor,
    backgroundColor: theme.backgroundColor,
    color: theme.foregroundColor,
  } as React.CSSProperties;

  useEffect(() => {
    setMounted(true);
  }, []);

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
  return (
    <main className="raffle-stage-screen relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12" style={stageStyle}>
      {mounted && hasWinner ? <div className="raffle-confetti raffle-confetti--active" aria-hidden="true">{CONFETTI_PIECES.map(([left, top, rotation, delay], index) => <span key={index} className="raffle-confetti-piece" style={{ "--confetti-left": left, "--confetti-top": top, "--confetti-rotation": rotation, "--confetti-delay": delay } as React.CSSProperties} />)}</div> : null}
      <div className="relative z-10 w-full max-w-6xl text-center">
        <div className="flex items-center justify-center gap-4">
          <p className="raffle-stage-accent text-sm font-semibold uppercase tracking-[0.32em]">Sorteo en vivo</p>
          {theme.logoUrl ? <img src={theme.logoUrl} alt="Logotipo del evento" className="h-14 max-w-48 object-contain sm:h-20 sm:max-w-64" /> : null}
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">{state.event.name}</h1>
        <div className="raffle-stage-prize mx-auto mt-8 max-w-3xl rounded-2xl border px-6 py-4 text-center" style={{ backgroundColor: theme.accentColor, borderColor: theme.accentColor, color: "#ffffff" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]">Premio en juego</p>
          <p className="mt-2 text-2xl font-semibold sm:text-4xl">{prize?.name ?? "Preparando el siguiente premio…"}</p>
        </div>
        <div className="raffle-stage-panel relative mt-8 rounded-[2rem] border px-6 py-12 shadow-2xl shadow-black/30 sm:px-12 sm:py-20" style={{ backgroundColor: `color-mix(in srgb, ${theme.foregroundColor} 4%, transparent)`, borderColor: `color-mix(in srgb, ${theme.foregroundColor} 12%, transparent)` }}>
          <div className="relative z-10">
          <p className="raffle-stage-subdued text-sm uppercase tracking-[0.24em]" style={{ color: `color-mix(in srgb, ${theme.foregroundColor} 50%, transparent)` }}>Código ganador</p>
          <p className="raffle-stage-accent mt-6 font-mono font-bold" style={{ color: theme.accentColor, fontSize: "clamp(3.5rem, 9vw, 9rem)", lineHeight: 1, letterSpacing: "0.18em" }}>{visibleCode}</p>
          {hasWinner ? <div className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700"><p className="text-3xl font-semibold sm:text-5xl">{draw?.attendeeName}</p><p className="raffle-stage-muted mt-3 text-xl sm:text-2xl">{draw?.attendeeCompany || "Participante ganador"}</p></div> : <p className="raffle-stage-muted mt-12 text-xl">El ganador aparecerá aquí</p>}
           <p className="mt-12 text-base font-medium sm:text-lg">{draw && !hasWinner ? "Preparando el resultado…" : "El próximo sorteo será iniciado en breve."}</p>
          </div>
        </div>
         <p className="raffle-stage-subdued mt-8 text-sm">Esta pantalla es exclusivamente de visualización.</p>
      </div>
    </main>
  );
}
