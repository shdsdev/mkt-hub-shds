"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { Sparkles, Sparkle } from "lucide";
import { HoverMorphIcon } from "@/components/hover-morph-icon";

const STORAGE_KEY = "gradient-border-enabled";
const CHANGE_EVENT = "gradient-border-change";

// useSyncExternalStore, not useState+useEffect — reading localStorage needs an effect anyway (it
// doesn't exist during SSR), and setState-in-an-effect is banned by this repo's lint config. This
// is the pattern React's own docs point to for exactly this case: subscribe to an external store
// instead of mirroring it into local state.
function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

function getServerSnapshot(): boolean {
  return true; // SSR has no localStorage — render as enabled, client syncs on hydration.
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

// The effect toggles by flipping a data attribute on <html> — app/globals.css un-generates the
// .gradient-border-frame::before pseudo-element entirely under [data-gradient-border="off"].
function applyState(enabled: boolean) {
  document.documentElement.dataset.gradientBorder = enabled ? "on" : "off";
}

// Tooltip markup written directly (not the shared <Tooltip>) so the real <button> stays the one
// tab stop and carries .t-tt-trigger itself — see src/components/tooltip.tsx's docstring.
export function GradientBorderToggle() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const tooltipId = useId();

  useEffect(() => {
    applyState(enabled);
  }, [enabled]);

  const toggle = () => {
    localStorage.setItem(STORAGE_KEY, enabled ? "off" : "on");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <span className="t-tt-wrap">
      <button
        type="button"
        onClick={toggle}
        aria-describedby={tooltipId}
        aria-pressed={enabled}
        className={`t-tt-trigger rounded-md p-1.5 hover:text-foreground ${
          enabled ? "text-accent" : "text-muted-foreground"
        }`}
      >
        <HoverMorphIcon idle={Sparkles} active={Sparkle} size={16} />
      </button>
      <span className="t-tt" id={tooltipId} role="tooltip">
        {enabled ? "Desactivar brillo del borde" : "Activar brillo del borde"}
      </span>
    </span>
  );
}
