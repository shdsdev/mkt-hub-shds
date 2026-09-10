import Link from "next/link";
import { ChartLine, ArrowUpRight } from "lucide";
import { HoverMorphIcon } from "@/components/hover-morph-icon";

export function AnalyticsLink({ linkId }: { linkId: string }) {
  return (
    <Link
      href={`/analytics/${linkId}`}
      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
    >
      <HoverMorphIcon idle={ChartLine} active={ArrowUpRight} />
      Ver analíticas
    </Link>
  );
}
