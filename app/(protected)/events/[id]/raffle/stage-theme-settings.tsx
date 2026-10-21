"use client";
/* eslint-disable @next/next/no-img-element -- the logo URL is user-configured and may be hosted externally. */

import { useActionState, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/tooltip";
import { normalizeRaffleStageTheme, type RaffleStageTheme } from "@/lib/raffle-stage-theme";
import { LogoUpload } from "../../../qr/logo-upload";
import { updateRaffleStageThemeAction, type RaffleActionState } from "./actions";

function SaveThemeButton() {
  return <Button type="submit">Guardar tema</Button>;
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function updateHexColor(value: string, setDraft: (value: string) => void, setColor: (value: string) => void) {
  setDraft(value);
  const normalized = value.trim().toLowerCase();
  if (HEX_COLOR_PATTERN.test(normalized)) setColor(normalized);
}

export function StageThemeSettings({
  eventId,
  raffleId,
  organizationId,
  theme,
}: {
  eventId: string;
  raffleId: string;
  organizationId: string;
  theme: RaffleStageTheme;
}) {
  const [state, action] = useActionState<RaffleActionState, FormData>(updateRaffleStageThemeAction, {});
  const [open, setOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(theme.backgroundColor);
  const [accentColor, setAccentColor] = useState(theme.accentColor);
  const [backgroundDraft, setBackgroundDraft] = useState(theme.backgroundColor);
  const [accentDraft, setAccentDraft] = useState(theme.accentColor);
  const [logoUrl, setLogoUrl] = useState(theme.logoUrl ?? "");
  const preview = normalizeRaffleStageTheme({ stageBackgroundColor: backgroundColor, stageAccentColor: accentColor, stageLogoUrl: logoUrl });

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm sm:p-6">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
        <span>
          <span className="flex items-center gap-2 font-heading text-xl font-semibold">Tema del escenario <Tooltip label="Personaliza la pantalla que verá el auditorio. El texto se ajusta automáticamente para conservar contraste."><Info className="size-4 text-muted-foreground" aria-hidden="true" /></Tooltip></span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">Define el ambiente visual del sorteo en vivo sin alterar la configuración de los premios.</span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <form action={action} hidden={!open} className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="raffleId" value={raffleId} />
        <input type="hidden" name="stageBackgroundColor" value={backgroundColor} />
        <input type="hidden" name="stageAccentColor" value={accentColor} />
        <input type="hidden" name="stageLogoUrl" value={logoUrl} />

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 border-b border-border/60 py-3 text-sm">
            <span><span className="block font-medium">Fondo</span><span className="text-xs text-muted-foreground">Superficie principal</span></span>
            <span className="flex items-center gap-2">
              <input aria-label="Color de fondo del escenario" type="color" value={backgroundColor} onChange={(event) => { setBackgroundColor(event.target.value); setBackgroundDraft(event.target.value); }} className="size-9 cursor-pointer rounded-lg border border-border bg-transparent p-1" />
              <Input aria-label="Hexadecimal del color de fondo" value={backgroundDraft} onChange={(event) => updateHexColor(event.target.value, setBackgroundDraft, setBackgroundColor)} onBlur={() => setBackgroundDraft(backgroundColor)} maxLength={7} placeholder="#0B0D12" className="w-28 font-mono text-xs uppercase" />
            </span>
          </label>
          <label className="flex items-center justify-between gap-3 border-b border-border/60 py-3 text-sm">
            <span><span className="block font-medium">Acento</span><span className="text-xs text-muted-foreground">Código y acciones</span></span>
            <span className="flex items-center gap-2">
              <input aria-label="Color de acento del escenario" type="color" value={accentColor} onChange={(event) => { setAccentColor(event.target.value); setAccentDraft(event.target.value); }} className="size-9 cursor-pointer rounded-lg border border-border bg-transparent p-1" />
              <Input aria-label="Hexadecimal del color de acento" value={accentDraft} onChange={(event) => updateHexColor(event.target.value, setAccentDraft, setAccentColor)} onBlur={() => setAccentDraft(accentColor)} maxLength={7} placeholder="#BEF264" className="w-28 font-mono text-xs uppercase" />
            </span>
          </label>
          <div className="sm:col-span-2">
            <LogoUpload organizationId={organizationId} onUploaded={(url) => setLogoUrl(url ?? "")} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/70 p-4" style={{ backgroundColor: preview.backgroundColor, color: preview.foregroundColor }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: preview.accentColor }}>Vista previa</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-lg font-semibold">Sorteo en vivo</p>
            {preview.logoUrl ? <img src={preview.logoUrl} alt="Logotipo del escenario" className="h-8 max-w-24 object-contain" /> : null}
          </div>
          <p className="mt-5 text-center font-mono text-3xl font-bold tracking-[0.16em]" style={{ color: preview.accentColor }}>CXB4TDCY</p>
          <p className="mt-3 text-center text-sm opacity-70">El ganador aparecerá aquí</p>
          <button type="button" className="mt-5 w-full rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: preview.accentColor, color: preview.accentForegroundColor }}>Sortear ganador</button>
        </div>

        <div className="flex flex-col gap-2 lg:col-span-2">
          <SaveThemeButton />
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <p role="status" className="text-sm text-accent">{state.success}</p> : null}
        </div>
      </form>
    </section>
  );
}
