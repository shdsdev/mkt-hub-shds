import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { EmailMarketingWizard } from "./email-marketing-wizard";

export default async function NewEmailCampaignPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  return (
    <main className="-m-6 flex min-h-[calc(100%+3rem)] w-[calc(100%+3rem)] min-w-0 flex-col gap-4 pb-10">
      <div className="px-6 pt-4">
        <Link href="/email-marketing" className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        ← Volver a Email Marketing
        </Link>
      </div>
      <EmailMarketingWizard />
    </main>
  );
}
