"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmbedSettings({ embedUrl, embedSnippet }: { embedUrl: string; embedSnippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    await navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-medium">Formulario embebible</h2>
        <p className="text-sm text-muted-foreground">Copiá este código para insertarlo en otro sitio.</p>
      </div>
      <Input readOnly value={embedUrl} aria-label="URL del formulario embebible" />
      <textarea
        readOnly
        value={embedSnippet}
        aria-label="Código HTML del formulario embebible"
        className="min-h-24 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copySnippet}>
          {copied ? "Código copiado" : "Copiar código"}
        </Button>
        <a
          href={embedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          Vista previa
        </a>
      </div>
    </section>
  );
}
