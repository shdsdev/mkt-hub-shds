"use client";

import { useState } from "react";

export function AccessCodeCopyButton({ code }: { code: string }) {
  const [status, setStatus] = useState("Folio de acceso");
  const [pending, setPending] = useState(false);

  async function copyCode() {
    setPending(true);
    setStatus("Copiando...");
    try {
      await navigator.clipboard.writeText(code);
      setStatus("Copiado");
    } catch {
      setStatus("No se pudo copiar");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={`Copiar folio de acceso ${code}`}
      aria-busy={pending}
      disabled={pending}
      onClick={copyCode}
      className="relative flex h-[72px] w-full min-w-0 cursor-pointer items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait"
    >
      <span role="status" aria-live="polite" className="absolute left-3 top-2 text-left text-[11px] font-medium uppercase tracking-wide text-primary/80">
        {status}
      </span>
      <span className="block font-mono text-4xl leading-none font-bold tracking-[0.16em] text-primary [overflow-wrap:anywhere]">
        {code}
      </span>
    </button>
  );
}
