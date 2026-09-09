"use client";

import { useEffect, useState } from "react";

export type QrPreviewParams = {
  shortLinkId?: string;
  payload?: string;
  backgroundColor: string;
  foregroundColor: string;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  logoUrl?: string;
};

// Debounced live preview against /qr/preview — revokes the previous object URL on each update so
// we don't leak blob URLs while the user is still adjusting colors.
export function useQrPreview(params: QrPreviewParams): string | undefined {
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    if (!params.shortLinkId && !params.payload) {
      const clear = setTimeout(() => {
        if (!cancelled) setPreviewUrl(undefined);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(clear);
      };
    }

    const timer = setTimeout(async () => {
      const response = await fetch("/qr/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!response.ok || cancelled) return;
      const blob = await response.blob();
      if (cancelled) return;
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.shortLinkId,
    params.payload,
    params.backgroundColor,
    params.foregroundColor,
    params.errorCorrectionLevel,
    params.logoUrl,
  ]);

  return previewUrl;
}
