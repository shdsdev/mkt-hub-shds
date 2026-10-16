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
    <section aria-labelledby="landing-link-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 id="landing-link-heading" className="text-sm font-medium">Landing pública</h2>
        <p className="text-xs text-muted-foreground">Revisá o compartí la página pública de este evento.</p>
      </div>
      <Input readOnly value={landingUrl} aria-label="URL de la landing pública" />
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={landingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
