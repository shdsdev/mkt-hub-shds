import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { listEmailSegments, listEmailSegmentMatches } from "@/modules/email-marketing";
import { EmailMarketingHeader } from "../email-marketing-header";
import { SegmentsWorkspace } from "./segments-workspace";

export default async function EmailSegmentsPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();
  const segments = await listEmailSegments(user.profile.organizationId);
  const segmentsWithCounts = await Promise.all(segments.map(async (segment) => ({
    ...segment,
    eligibleContactCount: (await listEmailSegmentMatches({ organizationId: user.profile.organizationId, definition: segment.definition })).filter((contact) => contact.subscriptionStatus === "subscribed").length,
  })));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10">
      <EmailMarketingHeader
        active="segments"
        eyebrow="Audiencias guardadas"
        title="Segmentos"
        description="Crea audiencias con filtros simples y reutilizalas en tus campañas."
      />
      <SegmentsWorkspace segments={segmentsWithCounts} />
    </main>
  );
}
