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
    <main className="raffle-stage-screen relative isolate flex min-h-0 flex-col items-center justify-center overflow-hidden px-[clamp(1rem,3vw,3rem)] py-[clamp(1rem,3vh,2.5rem)]" style={stageStyle}>
      {mounted && hasWinner ? <div className="raffle-confetti raffle-confetti--active" aria-hidden="true">{CONFETTI_PIECES.map(([left, top, rotation, delay], index) => <span key={index} className="raffle-confetti-piece" style={{ "--confetti-left": left, "--confetti-top": top, "--confetti-rotation": rotation, "--confetti-delay": delay } as React.CSSProperties} />)}</div> : null}
      <div className="relative z-10 flex h-full min-h-0 w-full max-w-6xl flex-col justify-center text-center">
        <div className="flex shrink-0 items-center justify-center gap-[clamp(0.75rem,2vw,1.5rem)]">
          <p className="raffle-stage-accent text-sm font-semibold uppercase tracking-[0.32em]">Sorteo en vivo</p>
          {theme.logoUrl ? <img src={theme.logoUrl} alt="Logotipo del evento" className="h-[clamp(3rem,7vh,5rem)] max-w-[clamp(10rem,20vw,16rem)] object-contain" /> : null}
        </div>
        <h1 className="mt-[clamp(0.5rem,1.5vh,1.25rem)] text-[clamp(2rem,5vw,4rem)] font-semibold leading-[0.95] tracking-tight">{state.event.name}</h1>
        <div className="raffle-stage-prize mx-auto mt-[clamp(1rem,2.5vh,2rem)] w-full max-w-3xl shrink-0 rounded-2xl border px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.65rem,1.5vh,1rem)] text-center" style={{ backgroundColor: theme.accentColor, borderColor: theme.accentColor, color: "#ffffff" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]">Premio en juego</p>
          <p className="mt-1 text-[clamp(1.25rem,2.5vw,2.25rem)] font-semibold leading-tight">{prize?.name ?? "Preparando el siguiente premio…"}</p>
        </div>
        <div className="raffle-stage-panel relative mt-[clamp(1rem,2.5vh,2rem)] min-h-0 flex-1 overflow-hidden rounded-[2rem] border px-[clamp(1rem,4vw,3rem)] py-[clamp(1.5rem,4vh,5rem)] shadow-2xl shadow-black/30" style={{ backgroundColor: `color-mix(in srgb, ${theme.foregroundColor} 4%, transparent)`, borderColor: `color-mix(in srgb, ${theme.foregroundColor} 12%, transparent)` }}>
          <div className="relative z-10 flex h-full min-h-0 flex-col justify-center">
          <p className="raffle-stage-subdued text-sm uppercase tracking-[0.24em]" style={{ color: `color-mix(in srgb, ${theme.foregroundColor} 50%, transparent)` }}>Código ganador</p>
          <p className="raffle-stage-accent mt-[clamp(0.75rem,2.5vh,1.5rem)] font-mono text-[clamp(2.75rem,min(10vw,12vh),8rem)] font-bold leading-none" style={{ color: theme.accentColor, letterSpacing: "0.18em" }}>{visibleCode}</p>
          {hasWinner ? <div className="mt-[clamp(1rem,3vh,3rem)] animate-in fade-in slide-in-from-bottom-4 duration-700"><p className="text-[clamp(1.75rem,4vw,3rem)] font-semibold leading-tight">{draw?.attendeeName}</p><p className="raffle-stage-muted mt-2 text-[clamp(1rem,2vw,1.5rem)]">{draw?.attendeeCompany || "Participante ganador"}</p></div> : <p className="raffle-stage-muted mt-[clamp(1rem,3vh,3rem)] text-[clamp(1rem,2vw,1.25rem)]">El ganador aparecerá aquí</p>}
            <p className="mt-[clamp(1rem,3vh,3rem)] text-[clamp(0.875rem,1.5vw,1.125rem)] font-medium">{draw && !hasWinner ? "Preparando el resultado…" : "El próximo sorteo será iniciado en breve."}</p>
          </div>
        </div>
          <p className="raffle-stage-subdued mt-[clamp(0.75rem,2vh,2rem)] shrink-0 text-sm">Esta pantalla es exclusivamente de visualización.</p>
       </div>
    </main>
  );
}
