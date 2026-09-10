"use client";

import { useState } from "react";
import { MorphIcon, type IconInput } from "morphicons/react";

/**
 * Project convention: any icon inside an interactive element (button, link,
 * submit) renders through this instead of a static lucide-react icon. `idle`
 * shows at rest, `active` is what it morphs into on hover — pick a pair that
 * reinforces what the action does (see docs/ARCHITECTURE.md "Icons").
 *
 * Icon inputs come from the `lucide` data package (IconNode), not
 * `lucide-react` components — `import { Download } from "lucide"`.
 *
 * Uncontrolled (default): the icon itself is the whole hoverable target
 * (e.g. a bare icon button) — it tracks its own hover.
 * Controlled: pass `hovered` when the hoverable target is bigger than the
 * icon (e.g. a pill button with a label) — the parent owns hover state and
 * drives the morph from its own onMouseEnter/Leave.
 */
export function HoverMorphIcon({
  idle,
  active,
  size = 16,
  hovered: hoveredProp,
}: {
  idle: IconInput;
  active: IconInput;
  size?: number;
  hovered?: boolean;
}) {
  const [internalHovered, setInternalHovered] = useState(false);

  if (hoveredProp !== undefined) {
    return <MorphIcon icon={hoveredProp ? active : idle} size={size} spring="snappy" />;
  }

  return (
    <span
      onMouseEnter={() => setInternalHovered(true)}
      onMouseLeave={() => setInternalHovered(false)}
      className="inline-flex"
    >
      <MorphIcon icon={internalHovered ? active : idle} size={size} spring="snappy" />
    </span>
  );
}
