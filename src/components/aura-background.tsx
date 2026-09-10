// Atmospheric gradient backdrops for aura-based themes (src/modules/users/theme-registry.ts:
// "nightfall", "greydlu", "aston", "signature"). Fixed behind the whole app (see .aura-bg in
// app/globals.css) — every layer here is decorative, so it's a static server component with no
// state.
export type AuraThemeId = "nightfall" | "greydlu" | "aston" | "signature";

const AURA_LAYER_COUNT: Record<AuraThemeId, number> = {
  nightfall: 3,
  greydlu: 2,
  aston: 3,
  signature: 4,
};

// "Nebula Flow" (signature) is grain-free per its own design spec — every other aura theme's
// spec calls for the film-grain overlay.
const AURA_HAS_GRAIN: Record<AuraThemeId, boolean> = {
  nightfall: true,
  greydlu: true,
  aston: true,
  signature: false,
};

function GrainOverlay() {
  return (
    <div className="aura-grain">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="aura-grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix
            type="matrix"
            values="0.181 0.608 0.061 0 0.075
                    0.181 0.608 0.061 0 0.075
                    0.181 0.608 0.061 0 0.075
                    0     0     0     1 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#aura-grain-filter)" />
      </svg>
    </div>
  );
}

export function AuraBackground({ theme }: { theme: AuraThemeId }) {
  const layerCount = AURA_LAYER_COUNT[theme];
  return (
    <div className="aura-bg" aria-hidden="true">
      <div className="aura-base" />
      {Array.from({ length: layerCount }, (_, i) => (
        <div key={i} className={`aura-layer aura-${theme}-layer-${i + 1}`} />
      ))}
      {AURA_HAS_GRAIN[theme] && <GrainOverlay />}
    </div>
  );
}
