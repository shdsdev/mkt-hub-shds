import { getCurrentUser } from "@/modules/auth";
import { listCampaigns } from "@/modules/campaigns";
import { CampaignForm } from "./campaign-form";
import { endCampaignAction } from "./actions";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const campaigns = await listCampaigns(user.profile.organizationId);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Campaigns</h1>
        <p className="text-sm text-muted-foreground">
          Ending a campaign never disables the links or QR codes it groups — a printed QR keeps
          working after the campaign ends.
        </p>
      </div>

      <CampaignForm />

      <ul className="space-y-2">
        {campaigns.length === 0 && (
          <li className="text-sm text-muted-foreground">No campaigns yet.</li>
        )}
        {campaigns.map((campaign) => (
          <li
            key={campaign.id}
            className="flex items-center justify-between rounded-md border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium">{campaign.name}</p>
              <p className="text-xs text-muted-foreground">{campaign.status}</p>
            </div>
            {campaign.status === "active" && (
              <form action={endCampaignAction}>
                <input type="hidden" name="campaignId" value={campaign.id} />
                <button type="submit" className="text-sm text-accent hover:underline">
                  End campaign
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
