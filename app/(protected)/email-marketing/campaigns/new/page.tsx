import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/modules/auth";
import { isActive, isAdmin } from "@/modules/users";
import { EmailMarketingWizard } from "./email-marketing-wizard";

export default async function NewEmailCampaignPage() {
  const user = await getCurrentUser();
  if (!user || !isActive(user.profile) || !isAdmin(user.profile)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      <Link href="/email-marketing" className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        ← Volver a Email Marketing
      </Link>
      <EmailMarketingWizard />
    </main>
  );
}
