"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LandingLink({ landingUrl }: { landingUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLandingUrl() {
    await navigator.clipboard.writeText(landingUrl);
    setCopied(true);
  }

  return (
    <section aria-labelledby="landing-link-heading" className="light-landing-surface flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="landing-link-heading" className="text-sm font-semibold">Landing pública</h2>
        <p className="text-xs text-muted-foreground">Revisá o compartí la página pública de este evento.</p>
      </div>
      <Input readOnly value={landingUrl} aria-label="URL de la landing pública" />
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={landingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-foreground hover:bg-accent/85"
        >
          Ver landing
        </a>
        <Button type="button" variant="outline" onClick={copyLandingUrl}>
          Copiar enlace
        </Button>
        {copied ? <span role="status" className="text-xs text-muted-foreground">Enlace copiado</span> : null}
      </div>
    </section>
  );
}
