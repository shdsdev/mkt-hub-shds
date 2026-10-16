"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon } from "lucide-react";

export function PlacementImagePreview({
  src,
  alt = "Referencia visual del QR",
}: {
  src: string;
  alt?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Ver imagen de referencia"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <ImageIcon size={14} aria-hidden="true" />
        Ver imagen
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
              role="dialog"
              aria-modal="true"
              aria-label={alt}
              onClick={() => setOpen(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
