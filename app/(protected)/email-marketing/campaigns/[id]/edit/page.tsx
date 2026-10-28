import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import {
  getEmailCampaign,
  listEmailSegments,
  listEligibleAudienceContacts,
  listEmailSegmentMatches,
} from "@/modules/email-marketing";
import { EmailMarketingWizard } from "../../new/email-marketing-wizard";

export default async function EditEmailCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  const campaign = await getEmailCampaign({ organizationId: user.profile.organizationId, campaignId: id });
  if (!campaign || campaign.status !== "draft") notFound();

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
        <Link href={`/email-marketing/campaigns/${campaign.id}`} className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          ← Volver a la campaña
        </Link>
      </div>
      <EmailMarketingWizard
        campaign={campaign}
        segments={segmentsWithCounts}
        eligibleContactCount={eligibleContacts.length}
      />
    </main>
  );
}
