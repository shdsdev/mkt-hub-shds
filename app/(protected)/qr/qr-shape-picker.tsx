"use client";

import { useEffect, useState } from "react";

// Same generic payload for every thumbnail — the point of the preview is to show what the shape
// looks like, not to encode anything real. Kept fixed and out of the cache key's variable part.
const PREVIEW_PAYLOAD = "https://ejemplo.com/vista-previa";

// Module-level cache (not component state): every QrShapePicker instance on the page shares it,
// so switching between the three pickers (cuerpo/marco del ojo/ojo) never re-fetches an image
// whose exact params were already rendered. Object URLs are never revoked — the set of distinct
// param combinations in one session is small (a handful of colors x 6-7 shapes), so the leak is
// bounded and not worth the bookkeeping.
const thumbnailCache = new Map<string, string>();

export type QrShapePreviewContext = {
  backgroundColor: string;
  foregroundColor: string;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  dotsType: string;
  cornersSquareType: string;
  cornersDotType: string;
};

function cacheKey(field: keyof QrShapePreviewContext, value: string, context: QrShapePreviewContext) {
  const params = { ...context, [field]: value };
  return JSON.stringify(params);
}

// Renders each shape option as a real, tiny rendering of the actual QR pipeline (via the same
// /qr/preview endpoint the live wizard preview uses) instead of a schematic CSS grid — the user
// asked for the option to "look identical" to what picking it produces, not an approximation.
// `field` says which of the three shape dimensions this picker controls; the other two stay at
// their current value from `context` so each thumbnail previews "this choice, given my other
// current choices" rather than an unrelated default combination.
export function QrShapePicker<T extends string>({
  field,
  options,
  value,
  onChange,
  context,
  active,
}: {
  field: "dotsType" | "cornersSquareType" | "cornersDotType";
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  context: QrShapePreviewContext;
  active: boolean;
}) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      const entries = await Promise.all(
        options.map(async (option) => {
          const key = cacheKey(field, option.value, context);
          const cached = thumbnailCache.get(key);
          if (cached) return [option.value, cached] as const;

          const response = await fetch("/qr/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload: PREVIEW_PAYLOAD,
              backgroundColor: context.backgroundColor,
              foregroundColor: context.foregroundColor,
              errorCorrectionLevel: context.errorCorrectionLevel,
              dotsType: field === "dotsType" ? option.value : context.dotsType,
              cornersSquareType: field === "cornersSquareType" ? option.value : context.cornersSquareType,
              cornersDotType: field === "cornersDotType" ? option.value : context.cornersDotType,
            }),
          });
          if (!response.ok) return [option.value, undefined] as const;
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          thumbnailCache.set(key, url);
          return [option.value, url] as const;
        }),
      );
      if (cancelled) return;
      const valid = entries.filter(
        (entry): entry is readonly [T, string] => entry[1] !== undefined,
      );
      setThumbnails(Object.fromEntries(valid));
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, field, context.backgroundColor, context.foregroundColor, context.errorCorrectionLevel, context.dotsType, context.cornersSquareType, context.cornersDotType]);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex flex-col items-center gap-1.5 rounded-md border p-2 transition-colors ${
            value === option.value ? "border-primary bg-primary/10" : "border-input hover:border-primary/50"
          }`}
        >
          <span
            className="size-12 rounded bg-background bg-contain bg-center bg-no-repeat"
            style={thumbnails[option.value] ? { backgroundImage: `url(${thumbnails[option.value]})` } : undefined}
          />
          <span className="text-center text-[11px] leading-tight text-muted-foreground">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
