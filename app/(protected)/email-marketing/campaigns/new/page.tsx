import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { EmailMarketingWizard } from "./email-marketing-wizard";
import { listEmailSegments, listEmailSegmentMatches, listEligibleAudienceContacts } from "@/modules/email-marketing";

export default async function NewEmailCampaignPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();
  const [segments, eligibleContacts] = await Promise.all([
    listEmailSegments(user.profile.organizationId),
    listEligibleAudienceContacts({ organizationId: user.profile.organizationId }),
  ]);
  const segmentsWithCounts = await Promise.all(segments.map(async (segment) => ({
    id: segment.id,
    name: segment.name,
    definition: segment.definition,
    eligibleContactCount: (await listEmailSegmentMatches({ organizationId: user.profile.organizationId, definition: segment.definition })).filter((contact) => contact.subscriptionStatus === "subscribed").length,
  })));

  return (
    <main className="mx-auto flex min-h-full w-full min-w-0 max-w-[1800px] flex-col gap-4 overflow-x-hidden pb-10 lg:-m-6 lg:w-[calc(100%+3rem)] lg:max-w-none">
      <div className="px-4 pt-4 sm:px-6">
        <Link href="/email-marketing" className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        ← Volver a Email Marketing
        </Link>
      </div>
      <section className="mx-4 rounded-2xl border border-border bg-card/60 p-4 sm:mx-6 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Audiencia disponible</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-background/40 p-4"><p className="text-xs text-muted-foreground">Todos los suscriptos</p><p className="mt-2 text-2xl font-semibold">{eligibleContacts.length}</p><p className="text-xs text-muted-foreground">contactos elegibles</p></div>
          {segmentsWithCounts.slice(0, 3).map((segment) => <div key={segment.id} className="rounded-xl border border-border bg-background/40 p-4"><p className="truncate text-xs text-muted-foreground">{segment.name}</p><p className="mt-2 text-2xl font-semibold">{segment.eligibleContactCount}</p><p className="text-xs text-muted-foreground">contactos elegibles</p></div>)}
        </div>
      </section>
    <EmailMarketingWizard
      segments={segmentsWithCounts}
     eligibleContactCount={eligibleContacts.length}
   />
    </main>
  );
}
