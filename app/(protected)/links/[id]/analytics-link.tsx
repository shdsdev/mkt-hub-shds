"use client";

import { useState } from "react";
import Link from "next/link";
import { MorphIcon } from "morphicons/react";
import { ChartLine, ArrowUpRight } from "lucide";

export function AnalyticsLink({ linkId }: { linkId: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/analytics/${linkId}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
    >
      <MorphIcon icon={hovered ? ArrowUpRight : ChartLine} size={16} spring="snappy" />
      Ver analíticas
    </Link>
  );
}
