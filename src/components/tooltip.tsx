"use client";

import { useId, type ReactNode } from "react";

/**
 * Project convention: this is the one tooltip. Pure CSS hover/focus effect —
 * styling and the transition live in app/globals.css under `.t-tt`/`.t-tt-wrap`
 * (Transitions.dev "Tooltip open/close"); this component only wires up the
 * markup and accessibility (aria-describedby, role="tooltip").
 *
 * `children` should be inert content (an icon, text, a colored cell) —
 * Tooltip supplies the focusable/hoverable trigger itself. For an
 * ALREADY-interactive trigger (a link, a submit button), don't wrap it here:
 * `cloneElement`-ing a Server Component's JSX inside a Client Component
 * hydrates inconsistently (SSR vs. client render diverge on the injected
 * props), so this component deliberately never clones its children. Instead
 * apply the `.t-tt-wrap`/`.t-tt-trigger`/`.t-tt` classes directly on your own
 * markup (see qr-list.tsx's QrActions) so the real element stays the one tab
 * stop, instead of adding a second, inert one around it.
 */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="t-tt-wrap">
      <span className="t-tt-trigger" tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span className="t-tt" id={id} role="tooltip">
        {label}
      </span>
    </span>
  );
}
