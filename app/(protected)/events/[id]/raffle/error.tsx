"use client";

export default function RaffleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex max-w-xl flex-col gap-3 p-8 text-center"><h1 className="font-heading text-2xl font-semibold">No se pudo cargar el sorteo</h1><p className="text-sm text-muted-foreground">Actualiza la página o inténtalo de nuevo.</p><button type="button" onClick={reset} className="mx-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reintentar</button></main>;
}
