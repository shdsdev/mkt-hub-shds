"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-heading text-2xl font-semibold">Algo salió mal</h1>
          <p className="text-sm text-muted-foreground">No pudimos cargar esta pantalla. Intentá nuevamente.</p>
          <button type="button" onClick={() => reset()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
